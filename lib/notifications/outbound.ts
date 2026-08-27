import http from 'node:http';
import https from 'node:https';
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
  if (code.startsWith('ERR_TLS') || code.startsWith('CERT_') || code === 'EPROTO') return 'tls';
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
      log.warn({ reason: error.message }, 'Outbound request blocked by policy');
      return { ok: false, code: 'blocked' };
    }
    return { ok: false, code: 'unknown' };
  }

  const client = target.parsed.protocol === 'https:' ? https : http;

  return new Promise<OutboundResult>((resolve) => {
    let settled = false;
    const settle = (result: OutboundResult) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const request = client.request(
      {
        protocol: target.parsed.protocol,
        // The hostname, not the pinned address, so the Host header and the TLS
        // server name stay correct for name-based virtual hosts.
        hostname: target.parsed.hostname,
        servername: target.parsed.protocol === 'https:' ? target.parsed.hostname : undefined,
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
      },
      (response) => {
        const status = response.statusCode ?? 0;

        // Discard without reading. Consuming the body would make this a
        // content oracle for whatever the server can reach.
        response.destroy();

        settle(categorizeStatus(status));
      }
    );

    request.on('timeout', () => {
      request.destroy();
      settle({ ok: false, code: 'timeout' });
    });

    request.on('error', (error: NodeJS.ErrnoException) => {
      // A destroy() from the timeout handler also emits here; the settled
      // guard keeps the first, more specific result.
      settle({ ok: false, code: categorizeError(error) });
    });

    request.write(body);
    request.end();
  });
}
