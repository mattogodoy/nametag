import { BlockedUrlError, outboundPolicy, resolveTarget } from '@/lib/net/url-validation';
import { parseNtfyUrl } from './channels/ntfy';
import { probeNtfyHealth } from './outbound';

/**
 * URL handling shared by endpoint creation and endpoint editing.
 *
 * Both routes have to normalise, reject, and validate a destination URL in
 * exactly the same way. Editing a URL that skipped any one of these checks
 * would be a way to reach a state creation refuses to produce, so the two
 * paths share one implementation rather than each keeping their own copy.
 */

/** Thrown when a URL carries a username or password. */
export class CredentialsInUrlError extends Error {}

/**
 * Ceiling on the stored URL, in bytes.
 *
 * `createEndpointSchema` caps the URL at 500 characters, but Zod's `.max()`
 * counts UTF-16 code units while normalisation percent-encodes, which expands
 * a non-ASCII character to up to 9 bytes. `@@unique([userId, url])` is a btree
 * index, and Postgres refuses an index entry near 2704 bytes, so a 495
 * character URL of non-ASCII path could pass validation and then fail at the
 * index as a raw 500 rather than a clean 400. Checked on the NORMALISED value,
 * since that is what is actually stored and indexed. The same guard exists on
 * `pushSubscribeSchema.endpoint` for the same reason.
 */
export const MAX_URL_BYTES = 2000;

export interface NormalizedEndpointUrl {
  /** The exact string to store, and to compare for uniqueness. */
  url: string;
  /**
   * The ntfy server root, for the health probe and for publishing. Null for a
   * webhook, which has no server-level endpoint to speak of.
   */
  ntfyBase: string | null;
}

/**
 * Normalise a webhook URL before it is stored, so the per-user unique
 * constraint on (userId, url) actually catches the same destination typed
 * two different ways.
 *
 * Unlike an ntfy topic URL, a webhook URL's path and query string are part of
 * its identity and must be preserved, not discarded down to an origin. The
 * WHATWG URL parser already lowercases the scheme and host for http(s) URLs;
 * this rebuilds the string explicitly (dropping only the fragment) so the
 * exact shape being stored is visible here rather than implied.
 *
 * Userinfo (`https://user:pw@host/...`) is rejected rather than silently
 * dropped. Rebuilding from `parsed.host` already discards it, which used to
 * mean a URL containing credentials was stored, shown back to the user, and
 * sent to without the credentials ever reaching the receiver: a webhook that
 * needs basic auth in its URL would then fail every single delivery with no
 * indication that anything was ever removed. Better to refuse it up front.
 */
function normalizeWebhookUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.username || parsed.password) {
    throw new CredentialsInUrlError();
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
}

/**
 * Normalise a destination URL for storage, or report why it cannot be stored.
 *
 * Returns null when the URL is structurally unusable for its type (an ntfy URL
 * with no topic, or with more path than a topic), which the caller turns into
 * an "enter a full topic URL" message. Throws `CredentialsInUrlError` for
 * userinfo, which needs its own message because a user cannot diagnose it by
 * re-reading their URL.
 */
export function normalizeEndpointUrl(
  type: 'NTFY' | 'WEBHOOK',
  url: string
): NormalizedEndpointUrl | null {
  if (type === 'NTFY') {
    // `parseNtfyUrl` builds its base from `URL.origin`, which silently
    // discards `user:pw@`. That is the same failure normalizeWebhookUrl
    // refuses for webhooks, and it bites identically here: the destination is
    // stored and rendered back without the credentials, then authenticates as
    // nobody and fails every delivery with nothing to indicate anything was
    // removed. ntfy's own auth belongs in the access-token field.
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      throw new CredentialsInUrlError();
    }

    // A URL with no topic would produce a request ntfy silently ignores, so
    // reject it here rather than letting it fail on every reminder forever.
    const parsedNtfy = parseNtfyUrl(url);
    if (!parsedNtfy) {
      return null;
    }

    // parseNtfyUrl already lowercases the host (via URL.origin) and drops the
    // trailing slash, so its own output is what both the uniqueness check and
    // every future outbound request should see.
    return { url: `${parsedNtfy.base}${parsedNtfy.topic}`, ntfyBase: parsedNtfy.base };
  }

  return { url: normalizeWebhookUrl(url), ntfyBase: null };
}

export type EndpointUrlRejection =
  | { code: 'too_long' }
  | { code: 'dns' | 'policy' | 'invalid' }
  | { code: 'not_ntfy' };

/**
 * Run every check that must hold before a URL is stored.
 *
 * Returns null when the URL is acceptable, or the reason it is not.
 *
 * The `code` matters as much as any message built from it: `policy` (a
 * disallowed protocol, port, or private address) is permanent and the user
 * must change the URL, while `dns` (the hostname did not resolve) can be a
 * transient resolver hiccup. Losing that distinction would tell a self-hoster
 * with a correct URL and a blipping resolver to go change it.
 *
 * Validation happens here as well as at send time. Save-time validation gives
 * the user an immediate error instead of a silently dead destination;
 * send-time validation is what actually protects us, because a hostname can be
 * re-pointed after it is saved.
 */
export async function checkEndpointUrl(
  normalized: NormalizedEndpointUrl
): Promise<EndpointUrlRejection | null> {
  if (Buffer.byteLength(normalized.url, 'utf8') > MAX_URL_BYTES) {
    return { code: 'too_long' };
  }

  try {
    await resolveTarget(normalized.url, outboundPolicy());
  } catch (error) {
    return { code: error instanceof BlockedUrlError ? error.reason : 'invalid' };
  }

  // Confirm an ntfy server actually answers here before saving. Without this,
  // a URL that merely parses like an ntfy topic is accepted, and any host
  // returning 2xx for a POST to `/` is recorded as a successful delivery every
  // night: the reminder is stamped as sent and never retried, so the
  // occurrence is silently and permanently lost. The send path has its own
  // guard (`expectJsonResponse` in sendNtfy), but catching it here is what
  // turns an invisible nightly failure into an error the user can still fix.
  //
  // Only a CONCLUSIVE "that is not ntfy" refuses the save. `unreachable` (a
  // timeout, a TLS error, a connection failure) is deliberately let through:
  // it proves nothing, and refusing on it would block every ntfy deployment
  // whose /v1/health this app cannot reach (behind Cloudflare Access, an auth
  // proxy, or a WAF) despite publishing working perfectly. That is the same
  // conflation the dns-versus-policy distinction above exists to avoid. A
  // host that is genuinely wrong almost always answers something, typically a
  // 404, which lands in `not_ntfy` and is still refused.
  //
  // Compared against the literal rather than tested for truthiness: every
  // NtfyProbeResult is a non-empty string, so a truthiness test silently
  // disables this guard entirely and still type-checks.
  if (normalized.ntfyBase !== null) {
    const probe = await probeNtfyHealth(normalized.ntfyBase);
    if (probe === 'not_ntfy') {
      return { code: 'not_ntfy' };
    }
  }

  return null;
}

/**
 * User-facing text for each rejection reason.
 *
 * Shared so the create form and the edit form cannot drift into describing the
 * same rejection two different ways. The `code` travels alongside it in the
 * response, and the client picks its own localised string from that; these
 * strings are the fallback for any client that does not.
 */
export const MESSAGE_BY_REJECTION: Record<EndpointUrlRejection['code'], string> = {
  too_long: 'That URL is too long',
  dns: 'That URL cannot be used',
  policy: 'That URL cannot be used',
  invalid: 'That URL cannot be used',
  not_ntfy: 'No ntfy server answered at that address',
};
