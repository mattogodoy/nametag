import { NextResponse } from 'next/server';
import { securityLogger } from './logger';

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
} as const;

export type RateLimitType = keyof typeof rateLimitConfigs;

/**
 * Get the client's IP address from the request
 */
function getClientIp(request: Request): string {
  // Check various headers that might contain the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to a default (this shouldn't happen in production)
  return 'unknown';
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
  const ip = getClientIp(request);

  // Create a unique key combining IP, type, and optional identifier
  const key = identifier ? `${type}:${ip}:${identifier}` : `${type}:${ip}`;

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

    // Log the rate limit violation
    securityLogger.rateLimitExceeded(ip, type, {
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
  const ip = getClientIp(request);
  const key = identifier ? `${type}:${ip}:${identifier}` : `${type}:${ip}`;
  rateLimitStore.delete(key);
}
