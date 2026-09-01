import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { securityLogger } from './logger';
import { resolveTrustedClientIp, warnNoTrustedClientIp } from '@/lib/net/client-ip';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// Note: This resets on server restart and doesn't work across multiple instances
// For production with multiple instances, use Redis or a similar distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Login: 5 attempts per 15 minutes
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
  // Register: 3 attempts per hour
  register: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
  },
  // Forgot password: 3 attempts per hour
  forgotPassword: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000,
  },
  // Reset password: 5 attempts per hour
  resetPassword: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  },
  // Resend verification: 3 attempts per 15 minutes
  resendVerification: {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
  },
  // CardDAV connection test: 10 attempts per 15 minutes
  carddavTest: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  },
  // CardDAV sync: 5 attempts per 5 minutes
  carddavSync: {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000,
  },
  // CardDAV backup: 5 attempts per 15 minutes
  carddavBackup: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
  // Verify email: 10 attempts per 15 minutes
  verifyEmail: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  },
  // Client-side error reports: 60 per 5 minutes. The endpoint is
  // unauthenticated, so this caps how much a single client can write to the
  // log while still allowing a genuinely broken page to report itself.
  clientErrorLog: {
    maxAttempts: 60,
    windowMs: 5 * 60 * 1000,
  },
  // Push subscribe: 20 per 15 minutes. Each write drives outbound HTTP later
  // (the nightly reminder run pushes to every stored subscription), so this
  // is a second guard alongside the per-user row cap enforced in the route.
  pushSubscribe: {
    maxAttempts: 20,
    windowMs: 15 * 60 * 1000,
  },
  // Creating an outbound endpoint: 10 per hour
  notificationEndpointCreate: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  },
  // Test send: tightest limit in the app. A synchronous, user-triggered
  // outbound request with immediate feedback is the most abusable surface in
  // the notification feature, so it is deliberately slower than everything else.
  //
  // Keyed per DESTINATION, so each one a user owns gets its own allowance.
  // Keyed per user it gave someone at the five-destination cap exactly one
  // test per destination per window, which they hit through ordinary setup.
  notificationEndpointTest: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
  // The per-user ceiling on test sends, checked BEFORE the destination is
  // looked up. Two limits rather than one because the per-destination key
  // above can only be built from a validated endpoint id, and validating it
  // means a database query: without a cheaper bound in front, that query
  // itself would be unmetered. Set to the per-destination allowance times the
  // per-user destination cap, so it never binds before the per-destination
  // limit does in ordinary use, and only catches someone cycling through
  // every destination they own at once.
  notificationEndpointTestPerUser: {
    maxAttempts: 5 * 5,
    windowMs: 15 * 60 * 1000,
  },
  // Per-EMAIL ceilings for the three unauthenticated endpoints that send mail
  // to an address the caller supplies. Deliberately looser than their
  // IP-keyed counterparts above, and the reason is the whole design:
  //
  // The IP bucket does the ordinary work and stops the common case. These
  // exist only to bound what no IP-scoped limit can, an attacker with a proxy
  // pool mail-bombing one address. Because the bucket is keyed on the address
  // rather than the sender, exhausting it necessarily also locks the owner of
  // that address out of the same action for the window. That trade is
  // unavoidable for per-address limiting and is what every mature service
  // makes, but it is only acceptable if the ceiling is high enough that a
  // real person never reaches it and an attacker has to actually send that
  // many emails to the victim to reach it. Set equal to the IP allowance
  // times a comfortable multiple: a legitimate user makes one or two
  // attempts and is stopped by their IP bucket long before this one.
  registerPerEmail: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  },
  forgotPasswordPerEmail: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000,
  },
  resendVerificationPerEmail: {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
  },
} as const;

export type RateLimitType = keyof typeof rateLimitConfigs;

/**
 * Distinguishes this process's shared fallback bucket from other instances'.
 * Random per process, never persisted: it only has to be distinct, and a
 * restart getting a fresh budget is the correct behaviour for a bucket that
 * exists to bound in-flight work.
 */
const PROCESS_BUCKET_ID = randomUUID();

/**
 * How much more the shared fallback bucket allows than the per-IP bucket, per
 * endpoint.
 *
 * The shared bucket is reached only when no trusted client IP could be
 * determined, and in that state it cannot distinguish callers at all. Sized
 * like a per-IP limit it became an instance-wide kill switch and a cheap one:
 * five requests denied login to every user (GHSA-qwj2-9jr7-f273). Widening it
 * raises that cost.
 *
 * But widening is NOT free, and it is not uniformly safe, which is why this is
 * a table rather than one constant. The cost of a widened bucket depends
 * entirely on what the endpoint does when it lets a request through:
 *
 * - Endpoints whose cost is LOCAL (CPU, a token comparison) can be widened
 *   generously. Being hammered wastes our own resources and nothing else, and
 *   for login the thing that actually stops a credential attack on an account
 *   is the per-account lockout in lib/auth.ts, which is independent of the
 *   client IP.
 *
 * - Endpoints that SEND MAIL TO A THIRD PARTY cannot. Their cost lands on
 *   people who did not ask for it, plus our sending reputation, and no
 *   per-account lockout mitigates that. The per-address ceilings bound what
 *   one victim receives; they do nothing about breadth, because an attacker
 *   sending to N distinct addresses gets a fresh per-address budget each time.
 *   A blanket 20x here would have taken forgot-password from 3 to 60 mails an
 *   hour to 60 DIFFERENT real people, from one anonymous caller, on any
 *   deployment sitting in the shared state. That is a worse bug than the
 *   denial it was meant to fix, so these get a small multiplier: enough that
 *   denying the endpoint is no longer a three-request trick, nowhere near
 *   enough to make the instance a useful mail cannon.
 *
 * - Everything else keeps its configured limit. Endpoints reached only by an
 *   authenticated caller always have an identifier and never land in this
 *   bucket at all, and for clientErrorLog the harm of being denied is that
 *   client errors go unlogged, which does not justify widening an
 *   unauthenticated write path.
 *
 * The shared state is not exotic: TRUSTED_PROXY_COUNT defaults to 1, so a
 * self-hosted instance published directly on its port with no reverse proxy
 * sends no forwarding header and sits here permanently. These numbers are
 * that deployment's real limits, not a rare degraded case.
 */
const SHARED_BUCKET_MULTIPLIERS: Record<RateLimitType, number> = {
  // Local cost only: CPU, or a token comparison.
  login: 20,
  resetPassword: 20,
  verifyEmail: 20,
  // Sends mail to an address the caller supplies.
  register: 5,
  forgotPassword: 5,
  resendVerification: 5,
  // An unauthenticated write path. Being denied it means client errors go
  // unlogged, which does not justify widening it.
  clientErrorLog: 1,
  // Reached only by an authenticated caller, which always supplies an
  // identifier, so these never land in the shared bucket at all. Listed
  // anyway because the type below is exhaustive on purpose.
  carddavTest: 1,
  carddavSync: 1,
  carddavBackup: 1,
  pushSubscribe: 1,
  notificationEndpointCreate: 1,
  notificationEndpointTest: 1,
  notificationEndpointTestPerUser: 1,
  registerPerEmail: 1,
  forgotPasswordPerEmail: 1,
  resendVerificationPerEmail: 1,
};

/** True when this key is the no-trusted-IP fallback rather than a real partition. */
function isSharedFallbackKey(key: string): boolean {
  return key.endsWith(`:shared:${PROCESS_BUCKET_ID}`);
}

/**
 * The attempt ceiling for one bucket, widened for the shared fallback.
 *
 * Exported so the Redis limiter applies the identical rule; two copies of
 * this is how the two limiters would drift into disagreeing about how many
 * requests an endpoint allows.
 */
export function maxAttemptsForKey(type: RateLimitType, key: string): number {
  const base = rateLimitConfigs[type].maxAttempts;
  if (!isSharedFallbackKey(key)) {
    return base;
  }
  return base * SHARED_BUCKET_MULTIPLIERS[type];
}

/**
 * Build the storage key for a rate-limit bucket.
 *
 * An identifier produces an IP-INDEPENDENT bucket, deliberately. This used to
 * return `${type}:${ip}:${identifier}` when both were available, which made
 * the identifier a mere narrowing of a bucket the IP already scoped, and that
 * had two consequences, both bad:
 *
 * - It provided no per-identifier bound at all in the recommended deployment.
 *   An attacker with a proxy pool got a fresh
 *   `forgotPassword:<newIp>:<victim@example.com>` bucket per source IP, so the
 *   "an attacker who rotates the client IP still shares a bucket with every
 *   other request for the same address" property the auth routes document was
 *   simply not true whenever a trusted IP was available.
 * - It made the keyed check dead code. The IP-only bucket and the composite
 *   bucket share a `maxAttempts`, so the IP-only check the auth routes run
 *   before parsing always tripped first, and the keyed check could never fire.
 *
 * Callers that want an IP bound as well as an identifier bound call this twice,
 * once with the identifier and once without, which is what the auth routes do
 * (see the pre-parse check in each). Every identifier in the app today is
 * either an authenticated `session.user.id` or an email on a route that mails
 * that address, so an IP-independent bound is the right one in both cases.
 * Note that `login` deliberately passes no identifier: an IP-independent
 * per-email bucket there would let anyone lock a victim out of their account.
 *
 * The `id:` segment namespaces identifier buckets away from IP buckets, so an
 * identifier that happens to look like an IP address cannot collide with one.
 *
 * With neither an IP nor an identifier there is nothing to partition on, so
 * every such request collapses into one shared bucket rather than being
 * exempted from rate limiting altogether, which is why that case is logged
 * loudly instead of happening quietly.
 */
export function buildRateLimitKey(
  type: RateLimitType,
  ip: string | null,
  identifier?: string,
  options: { report?: boolean } = {}
): string {
  if (identifier) {
    return `${type}:id:${identifier}`;
  }

  if (ip) {
    return `${type}:${ip}`;
  }

  // Reported only when this key is about to gate a request.
  //
  // `resetRateLimit` builds the same key in order to DELETE a bucket, which
  // is not a request being gated, so counting it would inflate the
  // `occurrences` figure this warning publishes and could be the thing that
  // emits the line. That is a correctness point about what the field means,
  // not a live bug: `resetRateLimit` currently has no production callers at
  // all (only its two definitions and tests reference it), so nothing
  // reaches this branch today. It is guarded because the field is documented
  // as a count of rate-limited requests and should stay true of whoever
  // wires the reset path up.
  if (options.report !== false) {
    warnNoTrustedClientIp();
  }
  // Scoped to this process, not to the deployment (GHSA-qwj2-9jr7-f273).
  //
  // With the Redis limiter, a single global `${type}:shared` key is shared by
  // every instance behind the load balancer, so one caller exhausting it
  // denies the endpoint across the entire fleet. Adding the process id caps
  // the blast radius at the one instance that served those requests; the
  // others keep their own budget and a load balancer keeps routing to them.
  //
  // This changes nothing for the in-memory limiter, whose store is already
  // per process, and nothing at all for any request that resolved a trusted
  // IP, which never reaches this line.
  return `${type}:shared:${PROCESS_BUCKET_ID}`;
}

/**
 * Check if a request should be rate limited
 * Returns null if allowed, or a NextResponse if rate limited
 */
export function checkRateLimit(
  request: Request,
  type: RateLimitType,
  identifier?: string // Optional additional identifier (e.g., email)
): NextResponse | null {
  cleanupExpiredEntries();

  const config = rateLimitConfigs[type];
  const ip = resolveTrustedClientIp(request);

  const key = buildRateLimitKey(type, ip, identifier);
  // Widened when this resolved to the shared fallback; see maxAttemptsForKey.
  const maxAttempts = maxAttemptsForKey(type, key);

  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window has expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null;
  }

  if (entry.count >= maxAttempts) {
    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    // Log the rate limit violation. The IP here is best-effort context for a
    // human reading logs, not a security decision, so 'unknown' is fine when
    // there is no trusted value.
    securityLogger.rateLimitExceeded(ip ?? 'unknown', type, {
      attempts: entry.count,
      maxAttempts,
      retryAfterSeconds,
      identifier: identifier || undefined,
    });

    return NextResponse.json(
      {
        error: `Too many attempts. Please try again in ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'}.`,
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  // Increment the counter
  entry.count++;
  return null;
}

/**
 * Reset rate limit for a specific key (e.g., after successful login)
 */
export function resetRateLimit(
  request: Request,
  type: RateLimitType,
  identifier?: string
): void {
  const ip = resolveTrustedClientIp(request);
  const key = buildRateLimitKey(type, ip, identifier, { report: false });
  rateLimitStore.delete(key);
}
