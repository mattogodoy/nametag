import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createModuleLogger } from '@/lib/logger';
import {
  BlockedUrlError,
  outboundPolicy,
  resolveTarget,
  stripIpv6Brackets,
  type PinnedTarget,
} from '@/lib/net/url-validation';

const log = createModuleLogger('notifications:outbound');

/**
 * Long enough for a slow but working receiver, short enough not to stall the
 * cron. Exported so every outbound channel, including web-push (which uses
 * the `web-push` library's own client rather than this one), shares the same
 * deadline instead of each channel picking its own number.
 */
export const TIMEOUT_MS = 5000;

export type OutboundFailureCode =
  | 'blocked'
  | 'dns'
  | 'timeout'
  | 'refused'
  | 'tls'
  | 'redirect'
  | 'http_4xx'
  | 'http_429'
  | 'http_5xx'
  // The destination answered 2xx but the response did not look like the
  // protocol we were speaking. Only produced when a caller opts in via
  // `expectJsonResponse`; see the ntfy driver for why that matters.
  | 'unexpected_response'
  | 'unknown';

export type OutboundResult = { ok: true } | { ok: false; code: OutboundFailureCode };

/**
 * Force every DNS lookup on this request to return one already-validated address.
 *
 * This is what makes the validation in resolveTarget binding. Without it, the
 * HTTP client performs its own lookup and the resolver is free to answer with
 * an internal address the second time, which is precisely the rebinding attack
 * the validation is meant to prevent.
 */
function pinnedLookup(target: PinnedTarget): http.ClientRequestArgs['lookup'] {
  return (_hostname, options, callback) => {
    const wantsAll = typeof options === 'object' && options !== null && options.all === true;

    if (wantsAll) {
      (callback as unknown as (
        err: null,
        addresses: Array<{ address: string; family: number }>
      ) => void)(null, [{ address: target.address, family: target.family }]);
      return;
    }

    (callback as unknown as (err: null, address: string, family: number) => void)(
      null,
      target.address,
      target.family
    );
  };
}

/**
 * Map a transport error onto a coarse category.
 *
 * Coarse on purpose. The caller shows this to the user, and a precise error
 * string would turn a webhook into a probe for mapping whatever the server can
 * reach.
 */
function categorizeError(error: NodeJS.ErrnoException): OutboundFailureCode {
  const code = error.code ?? '';

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'timeout';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns';
  if (code === 'ECONNREFUSED' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return 'refused';
  if (
    code.startsWith('ERR_TLS') ||
    code.startsWith('CERT_') ||
    code === 'EPROTO' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  ) {
    return 'tls';
  }
  if (code === 'ECONNRESET') return 'refused';

  return 'unknown';
}

/**
 * Map a 4xx/5xx HTTP status onto a coarse failure code.
 *
 * Exported and shared with web-push.ts (see failureCodeOf there) so the two
 * outbound channels cannot drift apart on the same taxonomy. That drift is
 * exactly how the 429-blames-the-token bug reappeared: two call sites each
 * rolling their own status-to-code mapping by hand. Centralising it here
 * means a third channel reuses this instead of writing a third copy.
 *
 * 429 is split out from the rest of 4xx on purpose: a destination's own rate
 * limit is transient by definition, and the UI shows a different message for
 * it than for a permanent-looking rejection (see endpointTestRateLimited).
 * Health tracking also excludes it from the auto-disable counter, see
 * endpoint-health.ts.
 */
export function httpStatusToFailureCode(status: number): OutboundFailureCode {
  if (status === 429) return 'http_429';
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_4xx';
  return 'unknown';
}

function categorizeStatus(status: number): OutboundResult {
  if (status >= 200 && status < 300) return { ok: true };
  if (status >= 300 && status < 400) return { ok: false, code: 'redirect' };
  return { ok: false, code: httpStatusToFailureCode(status) };
}

/** True when a Content-Type header names JSON (`application/json`, `+json`). */
function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const essence = contentType.split(';')[0].trim().toLowerCase();
  return essence === 'application/json' || essence.endsWith('+json');
}

export interface PostJsonOptions {
  /**
   * Treat a 2xx whose Content-Type is not JSON as a failure
   * (`unexpected_response`) rather than as a delivery.
   *
   * This exists for ntfy. Its publish endpoint answers with a JSON message
   * object, but any unrelated web server that happens to return 200 for a
   * POST to `/` would otherwise be recorded as a successful delivery, and the
   * reminder would be stamped and never retried: silent, permanent loss of
   * that occurrence.
   *
   * Only the Content-Type HEADER is inspected. The body is still never read,
   * so this does not turn the outbound client into a content oracle: it
   * distinguishes "spoke JSON" from "did not", and nothing more.
   */
  expectJsonResponse?: boolean;
}

/**
 * POST a JSON body to a user-supplied URL, as safely as we know how.
 *
 * Guarantees, each of which a test in tests/lib/notifications/outbound.test.ts
 * pins down:
 *
 * - The URL is validated against the mode-aware policy before any connection.
 * - The socket connects to the exact IP that validation approved.
 * - Redirects are never followed. node:http does not follow them at all, which
 *   is the behaviour we want: following one would land downstream of every
 *   check above.
 * - The response body is never read, so this cannot be used to exfiltrate the
 *   contents of an internal endpoint. `expectJsonResponse` inspects the
 *   Content-Type header only, never the body, so it does not weaken this.
 * - Only a coarse failure category is returned to the caller.
 * - The promise always resolves, never rejects, even when Node itself throws
 *   synchronously (invalid header names or values) or when the connection
 *   stalls after the socket timeout has already been reset by an inbound byte.
 */
export async function postJson(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: PostJsonOptions = {}
): Promise<OutboundResult> {
  let target: PinnedTarget;

  try {
    target = await resolveTarget(url, outboundPolicy());
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      if (error.reason === 'dns') {
        log.warn({ reason: error.message }, 'Outbound request failed DNS resolution');
        return { ok: false, code: 'dns' };
      }
      log.warn({ reason: error.message }, 'Outbound request blocked by policy');
      return { ok: false, code: 'blocked' };
    }
    // Not a policy rejection: something inside resolveTarget itself broke.
    // Worth knowing about in production even though the caller only sees
    // the coarse code.
    log.error({ error }, 'Outbound target resolution failed unexpectedly');
    return { ok: false, code: 'unknown' };
  }

  const client = target.parsed.protocol === 'https:' ? https : http;

  return new Promise<OutboundResult>((resolve) => {
    let settled = false;
    // A plain object, not a `let`, so the timer handle can be assigned once
    // below without ESLint's prefer-const flagging it, while still letting
    // `settle` clear it through this closure whether it runs before or after
    // the timer is created.
    const timers: { deadline?: ReturnType<typeof setTimeout> } = {};

    const settle = (result: OutboundResult) => {
      if (!settled) {
        settled = true;
        if (timers.deadline) clearTimeout(timers.deadline);
        resolve(result);
      }
    };

    // net.isIP returns 0 for a hostname, 4 or 6 for a literal address. An IP
    // literal is not a valid TLS server name and Node warns (DEP0123) if one
    // is passed as `servername`.
    //
    // Brackets are stripped first. `URL.hostname` keeps them for IPv6
    // (`https://[fd00::1]/x` gives `"[fd00::1]"`) and `net.isIP` returns 0 for
    // that form, so testing the raw hostname made this guard work for IPv4 and
    // silently do nothing for IPv6: a self-hosted `https://[fd00::1]/hook`
    // webhook got `servername: "[fd00::1]"`, an invalid SNI value, which is
    // exactly what the guard exists to prevent.
    const isIpLiteral = net.isIP(stripIpv6Brackets(target.parsed.hostname)) !== 0;

    let request: http.ClientRequest;
    try {
      request = client.request(
        {
          protocol: target.parsed.protocol,
          // The hostname, not the pinned address, so the Host header and the TLS
          // server name stay correct for name-based virtual hosts.
          hostname: target.parsed.hostname,
          servername:
            target.parsed.protocol === 'https:' && !isIpLiteral ? target.parsed.hostname : undefined,
          port: target.port,
          path: `${target.parsed.pathname}${target.parsed.search}`,
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
          },
          lookup: pinnedLookup(target),
          timeout: TIMEOUT_MS,
          // An explicit, non-pooled agent. node:http ignores proxy env vars by
          // default, but a future Node version (NODE_USE_ENV_PROXY) makes the
          // built-in client honour HTTP_PROXY through the global agent, and
          // under that the pinned lookup would apply to the proxy's hostname
          // instead of the validated target. A dedicated agent is immune to
          // that ambient configuration and avoids sharing a connection pool
          // with anything else in the process.
          agent: new client.Agent({ keepAlive: false }),
        },
        (response) => {
          const status = response.statusCode ?? 0;
          let result = categorizeStatus(status);

          // A 2xx from something that is not speaking our protocol. Checked
          // on the header only, before the body is discarded below, so the
          // never-read-the-body guarantee still holds.
          if (result.ok && options.expectJsonResponse) {
            const contentType = response.headers['content-type'];
            if (!isJsonContentType(Array.isArray(contentType) ? contentType[0] : contentType)) {
              log.warn(
                { host: target.parsed.hostname, status, contentType },
                'Outbound request got a 2xx that did not look like the expected protocol'
              );
              result = { ok: false, code: 'unexpected_response' };
            }
          }

          // The coarse code above is the right taxonomy for the user-facing
          // response (a 401, a 404, and a 422 all just need "the destination
          // rejected it"), but it is the wrong one for our own logs: nobody
          // operating this can tell those three apart from `code=http_4xx`
          // alone. Log the real status here, server-side only, and keep the
          // coarse code for everything returned to a caller.
          if (!result.ok) {
            log.warn(
              { host: target.parsed.hostname, status, code: result.code },
              'Outbound request received a non-success response'
            );
          }

          // Settle before destroying: the destroy() below can itself emit an
          // 'error' event, and the settled guard must already be armed with
          // the real outcome before that happens.
          settle(result);

          // Discard without reading. Consuming the body would make this a
          // content oracle for whatever the server can reach.
          response.destroy();
        }
      );
    } catch {
      // Node validates header names and values synchronously and throws for
      // things like a CRLF or a non-latin1 character in a header value. This
      // function's contract is to resolve with an outcome, never to reject,
      // so a caller can await it without a try/catch.
      settle({ ok: false, code: 'unknown' });
      return;
    }

    // A total deadline, distinct from the socket's `timeout` option above.
    // `timeout` is an inactivity timer: it resets on every inbound byte, so a
    // server that trickles one valid header byte every couple of seconds
    // keeps it from ever firing while never completing the response. Without
    // this, such a server hangs postJson, and by extension the cron that
    // awaits it, indefinitely.
    timers.deadline = setTimeout(() => {
      settle({ ok: false, code: 'timeout' });
      request.destroy();
    }, TIMEOUT_MS);
    timers.deadline.unref?.();

    request.on('timeout', () => {
      settle({ ok: false, code: 'timeout' });
      request.destroy();
    });

    request.on('error', (error: NodeJS.ErrnoException) => {
      // A destroy() from the timeout or deadline handlers above also emits
      // an 'error' here (typically ECONNRESET), after the outcome has
      // already been settled to 'timeout'. Logging the errno unconditionally
      // in that case would contradict the outcome actually recorded: an
      // operator would see errno=ECONNRESET, code=refused right next to a
      // result of 'timeout'. Only log when this error is the thing actually
      // deciding the outcome.
      if (!settled) {
        // The real errno, server-side only, for the same reason as the status
        // log above: `code=refused` alone does not tell an operator whether
        // that was ECONNREFUSED, EHOSTUNREACH, or ENETUNREACH.
        log.warn(
          { host: target.parsed.hostname, errno: error.code, code: categorizeError(error) },
          'Outbound request failed'
        );
      }
      // The settled guard keeps the first, more specific result.
      settle({ ok: false, code: categorizeError(error) });
    });

    request.write(body);
    request.end();
  });
}

/**
 * Ceiling on the ntfy health-probe response we are willing to buffer.
 *
 * ntfy's `/v1/health` answers with a tiny object (`{"healthy":true}`), so this
 * only needs to be large enough for that plus slack. It exists to stop a
 * hostile or broken host from streaming unbounded data into memory.
 */
const HEALTH_PROBE_MAX_BYTES = 1024;

/**
 * Ask whether a URL is served by something that behaves like ntfy.
 *
 * This is the ONLY place the outbound client reads a response body, and the
 * exception is deliberately narrow:
 *
 * - It is used at save time and test time, never on the nightly send path.
 * - It returns one of three fixed values. The body is parsed, checked, and
 *   discarded; no part of it reaches the caller, the UI, or a log. The
 *   information disclosed is whether an ntfy server answered, which is the
 *   minimum needed to tell a user their URL is wrong, and far less than the
 *   response-body oracle that `postJson` exists to avoid.
 * - At most HEALTH_PROBE_MAX_BYTES are buffered.
 *
 * Everything else is inherited from `resolveTarget`: policy validation, the
 * pinned address, no redirects.
 */
export type NtfyProbeResult =
  /** An ntfy server answered and reported itself healthy. */
  | 'ntfy'
  /** Something answered, but it is not an ntfy server. */
  | 'not_ntfy'
  /**
   * Nothing conclusive: a timeout, a TLS error, a connection failure, or a
   * resolver hiccup. Deliberately distinct from `not_ntfy`, because they call
   * for opposite responses. Refusing to save on `not_ntfy` is the whole point
   * of the probe; refusing to save on `unreachable` would block any ntfy
   * deployment whose `/v1/health` is not reachable from this app (behind
   * Cloudflare Access, an auth proxy, or a WAF) even though publishing to it
   * works perfectly.
   */
  | 'unreachable';

export async function probeNtfyHealth(baseUrl: string): Promise<NtfyProbeResult> {
  let target: PinnedTarget;

  try {
    target = await resolveTarget(`${baseUrl}v1/health`, outboundPolicy());
  } catch {
    return 'unreachable';
  }

  const client = target.parsed.protocol === 'https:' ? https : http;

  return new Promise<NtfyProbeResult>((resolve) => {
    let settled = false;
    const timers: { deadline?: ReturnType<typeof setTimeout> } = {};

    const settle = (value: NtfyProbeResult) => {
      if (!settled) {
        settled = true;
        if (timers.deadline) clearTimeout(timers.deadline);
        resolve(value);
      }
    };

    const isIpLiteral = net.isIP(stripIpv6Brackets(target.parsed.hostname)) !== 0;

    let request: http.ClientRequest;
    try {
      request = client.request(
        {
          protocol: target.parsed.protocol,
          hostname: target.parsed.hostname,
          servername:
            target.parsed.protocol === 'https:' && !isIpLiteral ? target.parsed.hostname : undefined,
          port: target.port,
          path: `${target.parsed.pathname}${target.parsed.search}`,
          method: 'GET',
          lookup: pinnedLookup(target),
          timeout: TIMEOUT_MS,
          agent: new client.Agent({ keepAlive: false }),
        },
        (response) => {
          const status = response.statusCode ?? 0;

          // Something answered and it was not a healthy ntfy endpoint. A 404
          // here is exactly what a mistyped host that happens to run a web
          // server looks like, which is the case worth refusing.
          if (status < 200 || status >= 300) {
            settle('not_ntfy');
            response.destroy();
            return;
          }

          let buffered = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            buffered += chunk;
            if (Buffer.byteLength(buffered, 'utf8') > HEALTH_PROBE_MAX_BYTES) {
              // ntfy's health response is a few dozen bytes. Anything this
              // large is not one, whatever else it is.
              settle('not_ntfy');
              response.destroy();
            }
          });
          response.on('end', () => {
            try {
              const parsed: unknown = JSON.parse(buffered);
              const healthy =
                typeof parsed === 'object' &&
                parsed !== null &&
                (parsed as { healthy?: unknown }).healthy === true;
              settle(healthy ? 'ntfy' : 'not_ntfy');
            } catch {
              // Answered 2xx with a body that is not ntfy's health JSON.
              settle('not_ntfy');
            }
          });
          // The response died mid-body. Nothing was proved either way.
          response.on('error', () => settle('unreachable'));
        }
      );
    } catch {
      settle('unreachable');
      return;
    }

    timers.deadline = setTimeout(() => {
      settle('unreachable');
      request.destroy();
    }, TIMEOUT_MS);
    timers.deadline.unref?.();

    request.on('timeout', () => {
      settle('unreachable');
      request.destroy();
    });
    request.on('error', () => settle('unreachable'));
    request.end();
  });
}
