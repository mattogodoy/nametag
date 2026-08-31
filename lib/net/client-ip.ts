/**
 * Client IP resolution.
 *
 * `resolveTrustedClientIp` is for security decisions (rate limiting, bans,
 * anything that gates behaviour on "who is this"). It returns `null` when
 * it cannot vouch for the result, and callers MUST treat `null` as "no
 * trustworthy IP", never coerce it to a placeholder string. There is no
 * best-effort, untrusted alternative in this module: an earlier version
 * exported one for logging, but nothing enforced that its callers only ever
 * logged it, and it was deleted once logging switched to the trusted
 * resolver (falling back to `getRawTrustedProxyHeaderForLogging` below when
 * resolution fails). Do not reintroduce a function that returns a
 * client-supplied IP string as if it were trustworthy; if a caller needs a
 * best-effort value for a human to read, it should call
 * `resolveTrustedClientIp` and handle `null` explicitly, or use
 * `getRawTrustedProxyHeaderForLogging` for the specific diagnostic case that
 * function exists for.
 *
 * Background: Next.js 16 removed `NextRequest.ip`, and this app runs as a
 * standalone Node server, so a route handler only ever sees a Web `Request`
 * with no peer address attached. The only IP information available at all
 * comes from headers a reverse proxy may set, which means it is only as
 * trustworthy as the proxy configuration in front of the app.
 *
 * Two settings in lib/env.ts govern this:
 *
 * - `TRUSTED_PROXY_COUNT`: how many proxy hops to trust (only meaningful in
 *   `x-forwarded-for` mode; see below).
 * - `TRUSTED_PROXY_HEADER`: which single header the trusted proxy actually
 *   manages: `x-forwarded-for` (default), `x-real-ip`, or `cf-connecting-ip`.
 *
 * The header setting exists because the possible proxy topologies are
 * indistinguishable from the request alone. A proxy that appends to
 * `x-forwarded-for` (nginx with `proxy_add_x_forwarded_for`, or Caddy) and a
 * proxy that only replaces `x-real-ip` (`proxy_set_header X-Real-IP
 * $remote_addr` with no `x-forwarded-for` handling at all) can each produce
 * a request that looks, byte for byte, like a syntactically valid instance
 * of the other topology: in the second case, the client's own
 * `x-forwarded-for` passes straight through untouched, and there is no way
 * to tell "the proxy appended this" from "the client sent exactly this and
 * nothing touched it" by inspecting the header's contents. Earlier versions
 * of this function tried to infer which topology was in play (prefer
 * `x-forwarded-for` when present, or fall back to `x-real-ip` when absent)
 * and each inference was wrong for one of the two topologies: it either let
 * an `x-real-ip`-only proxy's attacker send a raw `x-forwarded-for` straight
 * through as if trusted, or it broke honest clients behind an
 * `x-real-ip`-only proxy by refusing to read the one header that proxy
 * actually manages. There is no inference that is correct for all of them,
 * so the operator declares which one applies instead of the app guessing.
 *
 * `cf-connecting-ip` is the third option, for deployments behind Cloudflare.
 * Cloudflare OVERWRITES `CF-Connecting-IP` with the visitor's address on
 * every request that reaches it, rather than appending the way it does with
 * `X-Forwarded-For`, so there is no hop count to get wrong: either the
 * request came through Cloudflare's edge and the header is trustworthy, or
 * it did not and the header should not exist at all. That "or" is the whole
 * of this mode's security model, and it depends entirely on something this
 * function cannot see: whether the origin can be reached any other way. If
 * it can, an attacker sets `CF-Connecting-IP` directly and this function has
 * no chain, no count, and no second opinion to catch that, unlike
 * `x-forwarded-for` mode, where a wrong hop count still often lands on a
 * real address among several. See docs/self-hosting/reverse-proxy.md for
 * the three ways to enforce that precondition (origin firewall restricted to
 * Cloudflare's ranges, Authenticated Origin Pulls, or a Cloudflare Tunnel).
 */

import net from 'net';
import { env } from '@/lib/env';

// Deliberately not the pino logger from '@/lib/logger'. This module sits
// underneath both rate limiters, which a large number of existing tests
// mock '@/lib/logger' around without providing every export (much like
// lib/env.ts itself falls back to plain console output for the same
// layering reason). console.warn keeps this warning dependency-free.

/**
 * Resolve a client IP that is safe to use for a security decision, or
 * `null` if none can be determined.
 *
 * `null` is a real, expected outcome, not an error. Callers that need a
 * bucket key for a rate limiter or similar must decide for themselves how to
 * behave without an IP (fall back to another identifier, or a shared bucket
 * with a loud warning); they must never paper over `null` with a placeholder
 * string, because a placeholder is exactly what turns "we couldn't tell"
 * into "everyone shares a bucket" without anyone noticing.
 */
export function resolveTrustedClientIp(request: Request): string | null {
  const trustedProxyCount = env.TRUSTED_PROXY_COUNT;

  if (trustedProxyCount === 0) {
    // No reverse proxy is trusted to have set any of these headers,
    // regardless of TRUSTED_PROXY_HEADER. x-forwarded-for, x-real-ip, and
    // cf-connecting-ip all come straight from whoever made the request in
    // that case, so none of them is trustworthy for anything.
    return null;
  }

  if (env.TRUSTED_PROXY_HEADER === 'x-real-ip') {
    return resolveFromRealIp(request);
  }

  if (env.TRUSTED_PROXY_HEADER === 'cf-connecting-ip') {
    return resolveFromCfConnectingIp(request);
  }

  return resolveFromForwardedFor(request, trustedProxyCount);
}

/**
 * Resolve via x-forwarded-for, counting `trustedProxyCount` entries from the
 * right. Used when TRUSTED_PROXY_HEADER is 'x-forwarded-for' (the default).
 *
 * x-real-ip is not consulted here at all, not even when x-forwarded-for is
 * absent. An earlier version of this function fell back to x-real-ip in
 * exactly that case, reasoning that nginx's proxy_set_header (unlike
 * proxy_add_x_forwarded_for) REPLACES a client-supplied value, so it should
 * be safe for a single trusted hop. That reasoning is correct on its own,
 * but it silently assumes the proxy in front is the x-forwarded-for-managing
 * kind; it says nothing about whether *this* deployment's proxy is that
 * kind or the x-real-ip-only kind, and the request gives no way to tell the
 * two apart. Falling back to x-real-ip here means an x-real-ip-only proxy's
 * attacker, who controls the entirety of x-forwarded-for because that
 * proxy passes it through untouched, gets treated as trusted purely because
 * x-forwarded-for happened to be absent from *their specific request*
 * (typically it would not be, since they are the one crafting it). The only
 * sound fix is to stop guessing: a deployment behind an x-real-ip-only
 * proxy sets TRUSTED_PROXY_HEADER=x-real-ip and is handled by
 * resolveFromRealIp instead, never by this function.
 */
function resolveFromForwardedFor(request: Request, trustedProxyCount: number): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return null;
  }

  const hops = forwardedFor
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);

  // The documented reverse-proxy configs (nginx's proxy_add_x_forwarded_for,
  // Caddy's reverse_proxy) APPEND to any x-forwarded-for value the client
  // already sent rather than replacing it. A value the client fabricated
  // therefore always stays on the LEFT, and each proxy hop the request
  // legitimately passes through adds exactly one real entry on the RIGHT.
  // With N trusted proxies in front of this app, the real client address is
  // the Nth entry counting from the right, i.e. index (length - N). Reading
  // the leftmost entry, which looks like the natural choice, is precisely
  // the vulnerability this function exists to close: it lets an attacker
  // pick their own rate-limit bucket just by rotating that value.
  const clientIndex = hops.length - trustedProxyCount;

  if (clientIndex < 0) {
    // Fewer hops are present than the configured number of trusted
    // proxies. Either TRUSTED_PROXY_COUNT does not match this deployment,
    // or something stripped entries out of the header before it reached
    // us. Either way we cannot identify which entry, if any, is the real
    // client, and falling back to the leftmost one would hand back exactly
    // the attacker-controlled value this function must not return.
    return null;
  }

  const candidate = hops[clientIndex];

  // The candidate's position in the header is now trustworthy, but its
  // content is still attacker-influenced text until validated. An
  // unvalidated value would become part of a rate-limit bucket key, which
  // would let an attacker who cannot move the position still poison the
  // keyspace with garbage instead of an IP.
  return net.isIP(candidate) !== 0 ? candidate : null;
}

/**
 * Resolve via x-real-ip only. Used when TRUSTED_PROXY_HEADER is
 * 'x-real-ip', i.e. the operator has declared that their proxy manages this
 * header (via proxy_set_header, which REPLACES a client-supplied value)
 * rather than x-forwarded-for.
 *
 * x-forwarded-for is not consulted here at all, not even as a fallback. In
 * this topology the proxy does not manage x-forwarded-for, so any value
 * present in it passed straight through from the client unmodified: every
 * entry, at every position, is attacker-controlled. Reading the rightmost
 * entry the way resolveFromForwardedFor does is no safer here, since an
 * attacker who knows the count simply sends that many entries and controls
 * whichever one lands in the trusted position. There is exactly one
 * trustworthy value in this topology, and it is x-real-ip itself.
 *
 * TRUSTED_PROXY_COUNT does not apply to this path (beyond the count === 0
 * check already handled by the caller). proxy_set_header REPLACES the
 * header with a single value; there is no chain of appended hops to count
 * through, only one value that is either the proxy's own or nothing.
 */
function resolveFromRealIp(request: Request): string | null {
  const realIp = request.headers.get('x-real-ip');
  if (!realIp) {
    return null;
  }

  const trimmed = realIp.trim();
  return net.isIP(trimmed) !== 0 ? trimmed : null;
}

/**
 * Resolve via cf-connecting-ip only. Used when TRUSTED_PROXY_HEADER is
 * 'cf-connecting-ip', i.e. the operator has declared that Cloudflare sits
 * directly in front of the origin and traffic cannot reach the origin any
 * other way (see the module doc comment and
 * docs/self-hosting/reverse-proxy.md for why that precondition is the
 * entire security model of this mode).
 *
 * x-forwarded-for and x-real-ip are not consulted here at all, not even as
 * a fallback. Behind Cloudflare, a client can put anything it likes in
 * either of those two headers and Cloudflare will pass them through to the
 * origin proxy unchanged; only cf-connecting-ip is the one Cloudflare
 * itself overwrites.
 *
 * TRUSTED_PROXY_COUNT does not apply to this path either, for the same
 * reason it does not apply to resolveFromRealIp: Cloudflare OVERWRITES this
 * header with the visitor's address on every request rather than appending
 * to a chain, so there is a single value to trust, not a count of hops.
 */
function resolveFromCfConnectingIp(request: Request): string | null {
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (!cfConnectingIp) {
    return null;
  }

  const trimmed = cfConnectingIp.trim();
  return net.isIP(trimmed) !== 0 ? trimmed : null;
}

/**
 * A client can send an arbitrarily long header value; without a bound, that
 * is a free way to inflate every log line that includes it. This is
 * generous enough to hold a realistic x-forwarded-for chain (several dozen
 * IPv6 addresses) while still capping the worst case.
 */
const MAX_LOGGED_RAW_HEADER_LENGTH = 500;

/**
 * Get the raw value of whichever header TRUSTED_PROXY_HEADER is configured
 * to read, truncated to a bounded length, for DIAGNOSTIC LOGGING ONLY.
 *
 * Callers should only include this in a log entry when
 * `resolveTrustedClientIp` returned `null` for the same request, never on
 * every request: this is exactly the raw, untrusted value that resolution
 * failed to validate, so its only purpose is letting an operator see what
 * actually arrived and work out the right TRUSTED_PROXY_COUNT or
 * TRUSTED_PROXY_HEADER value. Logging it unconditionally would both add
 * noise to every request and let a client inflate every log line by sending
 * a long header, which the truncation here bounds but does not eliminate on
 * its own.
 *
 * Returns `undefined` (not `null`) when the configured header is absent,
 * so callers can spread it into a log object and have the key disappear
 * entirely rather than appearing with an empty value.
 *
 * Also returns `undefined` whenever `TRUSTED_PROXY_COUNT` is 0. That is the
 * value `.env.example` tells an operator to set when there is no reverse
 * proxy at all, and in that configuration `resolveTrustedClientIp` returns
 * `null` on every single request by design, without ever reading a header.
 * The `null` therefore carries no diagnostic information, so attaching the
 * raw header would put up to 500 bytes of client-controlled text on every
 * access log line forever: precisely the per-request inflation the paragraph
 * above says to avoid, reached through the one configuration where the
 * caller's "only when resolution failed" guard is always true.
 */
export function getRawTrustedProxyHeaderForLogging(request: Request): string | undefined {
  if (env.TRUSTED_PROXY_COUNT === 0) {
    return undefined;
  }

  const value = request.headers.get(env.TRUSTED_PROXY_HEADER);
  if (!value) {
    return undefined;
  }

  return value.length > MAX_LOGGED_RAW_HEADER_LENGTH
    ? `${value.slice(0, MAX_LOGGED_RAW_HEADER_LENGTH)}...(truncated)`
    : value;
}

let warnedMissingTrustedIp = false;

/**
 * Log, once per process, that a rate limiter could not determine a trusted
 * client IP and is falling back to a shared bucket.
 *
 * This exists because a silently shared bucket is how a rate limit stays
 * broken for months: every unauthenticated request with no other identifier
 * collapses into one counter, and nothing about that is visible unless an
 * operator goes looking. Logging it once (rather than per request) keeps a
 * misconfigured deployment from flooding its own logs while still surfacing
 * the problem.
 */
export function warnNoTrustedClientIp(): void {
  if (warnedMissingTrustedIp) return;
  warnedMissingTrustedIp = true;
  console.warn(
    '[rate-limit] No trusted client IP could be determined for a rate-limited request. ' +
      'Falling back to a single shared bucket for every request with no other ' +
      'identifier, which weakens rate limiting fleet-wide. Check TRUSTED_PROXY_COUNT ' +
      '(must equal the number of reverse proxies in front of Nametag) and ' +
      'TRUSTED_PROXY_HEADER (must match the header your proxy actually manages: ' +
      'x-forwarded-for, x-real-ip, or cf-connecting-ip).'
  );
}
