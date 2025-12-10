import { NextResponse } from 'next/server';
import { getRedis, isRedisConnected } from './redis';
import { securityLogger } from './logger';
import { rateLimitConfigs, type RateLimitType } from './rate-limit';

/**
 * Redis-based distributed rate limiting
 * 
 * Features:
 * - Works across multiple server instances
 * - Persists across server restarts
 * - Automatic key expiration
 * - Falls back to in-memory if Redis unavailable (dev only)
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Fallback in-memory store for development
const memoryStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetTime) {
      memoryStore.delete(key);
    }
  }
}

/**
 * Get client IP from request
 */
function getClientIp(request: Request): string {
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
 * Check rate limit using Redis
 */
async function checkRateLimitRedis(
  key: string,
  maxAttempts: number,
  windowMs: number,
  ip: string,
  type: RateLimitType,
  identifier?: string
): Promise<NextResponse | null> {
  const redis = getRedis();
  
  if (!redis) {
    // Fallback to memory store in development
    if (process.env.NODE_ENV !== 'production') {
      return checkRateLimitMemory(key, maxAttempts, windowMs, ip, type, identifier);
    }
    
    // In production, fail open (allow request) but log warning
    securityLogger.suspiciousActivity(ip, 'Redis client not initialized', {
      type,
      identifier,
    });
    return null;
  }

  // Try to check connection status with a quick ping
  // Note: In Next.js, API routes run in workers, so connection check may be delayed
  if (!isRedisConnected()) {
    try {
      await redis.ping();
      // If ping succeeds, Redis is connected (connection status will update asynchronously)
    } catch (error) {
      // Redis is genuinely not available
      if (process.env.NODE_ENV !== 'production') {
        return checkRateLimitMemory(key, maxAttempts, windowMs, ip, type, identifier);
      }
      
      // Log at debug level since this is expected on first request in Next.js workers
      // (Redis connects asynchronously in each worker process)
      return null;
    }
  }

  try {
    const now = Date.now();
    const windowSec = Math.ceil(windowMs / 1000);

    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSec);
    pipeline.ttl(key);
    
    const results = await pipeline.exec();
    
    if (!results) {
      throw new Error('Redis pipeline returned null');
    }

    const [[, count], , [, ttl]] = results as [[null, number], [null, number], [null, number]];
    
    if (count > maxAttempts) {
      const retryAfterSeconds = ttl > 0 ? ttl : windowSec;
      const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

      securityLogger.rateLimitExceeded(ip, type, {
        attempts: count,
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
            'X-RateLimit-Limit': String(maxAttempts),
            'X-RateLimit-Remaining': String(Math.max(0, maxAttempts - count)),
            'X-RateLimit-Reset': String(Math.floor(now / 1000) + retryAfterSeconds),
          },
        }
      );
    }

    return null;
  } catch (error) {
    // Log error but fail open in production to avoid blocking all requests
    securityLogger.suspiciousActivity(ip, 'Redis error during rate limiting', {
      type,
      identifier,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return null;
  }
}

/**
 * Fallback to memory-based rate limiting
 */
function checkRateLimitMemory(
  key: string,
  maxAttempts: number,
  windowMs: number,
  ip: string,
  type: RateLimitType,
  identifier?: string
): NextResponse | null {
  cleanupMemoryStore();

  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return null;
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);

    securityLogger.rateLimitExceeded(ip, type, {
      attempts: entry.count,
      maxAttempts,
      retryAfterSeconds,
      identifier: identifier || undefined,
      fallback: 'memory',
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
          'X-RateLimit-Limit': String(maxAttempts),
          'X-RateLimit-Remaining': String(Math.max(0, maxAttempts - entry.count)),
          'X-RateLimit-Reset': String(Math.floor(entry.resetTime / 1000)),
        },
      }
    );
  }

  entry.count++;
  return null;
}

/**
 * Check rate limit (main export)
 * Automatically uses Redis if available, falls back to memory if not
 */
export async function checkRateLimit(
  request: Request,
  type: RateLimitType,
  identifier?: string
): Promise<NextResponse | null> {
  const config = rateLimitConfigs[type];
  const ip = getClientIp(request);
  const key = identifier ? `ratelimit:${type}:${ip}:${identifier}` : `ratelimit:${type}:${ip}`;

  return checkRateLimitRedis(
    key,
    config.maxAttempts,
    config.windowMs,
    ip,
    type,
    identifier
  );
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(
  request: Request,
  type: RateLimitType,
  identifier?: string
): Promise<void> {
  const redis = getRedis();
  const ip = getClientIp(request);
  const key = identifier ? `ratelimit:${type}:${ip}:${identifier}` : `ratelimit:${type}:${ip}`;

  if (redis && isRedisConnected()) {
    try {
      await redis.del(key);
    } catch (error) {
      // Log but don't throw
      securityLogger.suspiciousActivity(ip, 'Failed to reset rate limit', {
        type,
        identifier,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    // Fallback to memory store
    memoryStore.delete(key);
  }
}

