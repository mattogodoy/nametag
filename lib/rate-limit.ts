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
  notificationEndpointTest: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  },
} as const;

export type RateLimitType = keyof typeof rateLimitConfigs;

/**
 * Build the storage key for a rate-limit bucket.
 *
 * With a trusted IP, the key is IP-scoped, optionally narrowed further by an
 * identifier such as an email. Without a trusted IP, an identifier alone is
 * still a real per-account bound, so it is used on its own rather than
 * discarded. With neither, there is nothing to partition on: every such
 * request collapses into one shared bucket rather than being exempted from
 * rate limiting altogether, which is why a shared bucket is logged loudly
 * instead of happening quietly.
 */
export function buildRateLimitKey(
  type: RateLimitType,
  ip: string | null,
  identifier?: string
): string {
  if (ip) {
    return identifier ? `${type}:${ip}:${identifier}` : `${type}:${ip}`;
  }

  if (identifier) {
    return `${type}:${identifier}`;
  }

  warnNoTrustedClientIp();
  return `${type}:shared`;
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

  if (entry.count >= config.maxAttempts) {
    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    // Log the rate limit violation. The IP here is best-effort context for a
    // human reading logs, not a security decision, so 'unknown' is fine when
    // there is no trusted value.
    securityLogger.rateLimitExceeded(ip ?? 'unknown', type, {
      attempts: entry.count,
      maxAttempts: config.maxAttempts,
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
  const key = buildRateLimitKey(type, ip, identifier);
  rateLimitStore.delete(key);
}
