/**
 * Client IP resolution.
 *
 * There are exactly two ways to read a client IP from a request in this app,
 * and they must never be confused for one another:
 *
 * - `resolveTrustedClientIp` is for security decisions (rate limiting, bans,
 *   anything that gates behaviour on "who is this"). It returns `null` when
 *   it cannot vouch for the result, and callers MUST treat `null` as "no
 *   trustworthy IP", never coerce it to a placeholder string.
 * - `getClientIp` is for logging only. It always returns a string, including
 *   a client-supplied one, because a human reading logs benefits from a
 *   best-effort value even when it cannot be trusted.
 *
 * Background: Next.js 16 removed `NextRequest.ip`, and this app runs as a
 * standalone Node server, so a route handler only ever sees a Web `Request`
 * with no peer address attached. The only IP information available at all
 * comes from headers a reverse proxy may set, which means it is only as
 * trustworthy as the proxy configuration in front of the app. `TRUSTED_PROXY_COUNT`
 * (see lib/env.ts) is how an operator tells this module how many proxy hops
 * to trust.
 */

import net from 'net';
import { env } from '@/lib/env';

// Deliberately not the pino logger from '@/lib/logger'. This module sits
// underneath both rate limiters, which a large number of existing tests
// mock '@/lib/logger' around without providing every export (much like
// lib/env.ts itself falls back to plain console output for the same
// layering reason). console.warn keeps this warning dependency-free.

/**
 * Get a best-effort client IP for LOGGING ONLY.
 *
 * NEVER use this for a security decision (rate limiting, allow/deny lists,
 * lockouts, anything that partitions behaviour by "who sent this"). It reads
 * `x-forwarded-for` (the leftmost entry) and falls back to `x-real-ip`, then
 * `'unknown'`. Both headers are attacker-supplied on any request that reaches
 * this process, and the leftmost `x-forwarded-for` entry in particular is
 * exactly the value a client can set to whatever it wants: a reverse proxy
 * that appends to the header (the documented nginx and Caddy configs both do)
 * only ever adds entries to the right, so the leftmost one is never
 * validated by anything we control. That is fine for a log line a human will
 * read, and disqualifying for anything that gates behaviour.
 *
 * Use `resolveTrustedClientIp` for security decisions instead.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

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
    // No reverse proxy is trusted to have set these headers. Both
    // x-forwarded-for and x-real-ip come straight from whoever made the
    // request in that case, so neither is trustworthy for anything.
    return null;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
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

  // x-real-ip is only considered when x-forwarded-for is absent. Nginx's
  // proxy_set_header (unlike proxy_add_x_forwarded_for) REPLACES any
  // client-supplied value, so behind the documented config it always carries
  // the proxy's own view of the connecting peer for a single trusted hop.
  // We already returned above when trustedProxyCount is 0, so by this point
  // at least one hop is trusted.
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    const trimmed = realIp.trim();
    return net.isIP(trimmed) !== 0 ? trimmed : null;
  }

  return null;
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
      'identifier, which weakens rate limiting fleet-wide. Check TRUSTED_PROXY_COUNT: ' +
      'it must equal the number of reverse proxies in front of Nametag that append to X-Forwarded-For.'
  );
}
