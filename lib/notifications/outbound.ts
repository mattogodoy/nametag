import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createModuleLogger } from '@/lib/logger';
import {
  BlockedUrlError,
  outboundPolicy,
  resolveTarget,
  type PinnedTarget,
} from '@/lib/net/url-validation';

const log = createModuleLogger('notifications:outbound');

/** Long enough for a slow but working receiver, short enough not to stall the cron. */
const TIMEOUT_MS = 5000;

export type OutboundFailureCode =
  | 'blocked'
  | 'dns'
  | 'timeout'
  | 'refused'
  | 'tls'
  | 'redirect'
  | 'http_4xx'
  | 'http_5xx'
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

function categorizeStatus(status: number): OutboundResult {
  if (status >= 200 && status < 300) return { ok: true };
  if (status >= 300 && status < 400) return { ok: false, code: 'redirect' };
  if (status >= 400 && status < 500) return { ok: false, code: 'http_4xx' };
  return { ok: false, code: 'http_5xx' };
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
 *   contents of an internal endpoint.
 * - Only a coarse failure category is returned to the caller.
 * - The promise always resolves, never rejects, even when Node itself throws
 *   synchronously (invalid header names or values) or when the connection
 *   stalls after the socket timeout has already been reset by an inbound byte.
 */
export async function postJson(
  url: string,
  body: string,
  headers: Record<string, string>
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
    const isIpLiteral = net.isIP(target.parsed.hostname) !== 0;

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

          // Settle before destroying: the destroy() below can itself emit an
          // 'error' event, and the settled guard must already be armed with
          // the real outcome before that happens.
          settle(categorizeStatus(status));

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
      // A destroy() from the timeout or deadline handlers also emits here;
      // the settled guard keeps the first, more specific result.
      settle({ ok: false, code: categorizeError(error) });
    });

    request.write(body);
    request.end();
  });
}
