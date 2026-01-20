import { getRedis, isRedisConnected } from './redis';
import { logger } from './logger';

/**
 * Token Blacklist
 *
 * Manages invalidated JWT tokens to prevent session fixation attacks.
 * When a user logs out, their token is blacklisted until its natural expiration.
 *
 * Uses Redis when available, falls back to in-memory Map otherwise.
 */

// In-memory fallback for when Redis is not available
const inMemoryBlacklist = new Map<string, number>();

/**
 * Blacklist a token
 * @param tokenId - Unique token identifier (jti claim)
 * @param expiresAt - Token expiration timestamp (for TTL)
 */
export async function blacklistToken(tokenId: string, expiresAt: Date): Promise<void> {
  const now = Date.now();
  const expiresAtMs = expiresAt.getTime();

  // If token is already expired, no need to blacklist
  if (expiresAtMs <= now) {
    return;
  }

  // Calculate TTL in seconds
  const ttlSeconds = Math.ceil((expiresAtMs - now) / 1000);

  try {
    if (isRedisConnected()) {
      const redis = getRedis();
      if (redis) {
        // Store in Redis with automatic expiration
        await redis.setex(`blacklist:${tokenId}`, ttlSeconds, '1');
        logger.info('Token blacklisted in Redis', { tokenId, ttlSeconds });
        return;
      }
    }

    // Fallback to in-memory storage
    inMemoryBlacklist.set(tokenId, expiresAtMs);
    logger.info('Token blacklisted in memory', { tokenId });

    // Clean up expired in-memory entries periodically
    cleanupInMemoryBlacklist();
  } catch (error) {
    logger.error('Failed to blacklist token', { tokenId }, error as Error);
    // Fallback to in-memory even if Redis fails
    inMemoryBlacklist.set(tokenId, expiresAtMs);
  }
}

/**
 * Check if a token is blacklisted
 * @param tokenId - Unique token identifier (jti claim)
 * @returns true if token is blacklisted, false otherwise
 */
export async function isTokenBlacklisted(tokenId: string): Promise<boolean> {
  try {
    if (isRedisConnected()) {
      const redis = getRedis();
      if (redis) {
        const result = await redis.get(`blacklist:${tokenId}`);
        if (result !== null) {
          return true;
        }
      }
    }

    // Fallback to in-memory storage
    const expiresAt = inMemoryBlacklist.get(tokenId);
    if (!expiresAt) {
      return false;
    }

    // Check if entry has expired
    if (expiresAt <= Date.now()) {
      inMemoryBlacklist.delete(tokenId);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to check token blacklist', { tokenId }, error as Error);
    // Fail open - if we can't check, allow access
    // This prevents blocking all users if Redis fails
    return false;
  }
}

/**
 * Clean up expired entries from in-memory blacklist
 */
function cleanupInMemoryBlacklist(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  for (const [tokenId, expiresAt] of inMemoryBlacklist.entries()) {
    if (expiresAt <= now) {
      entriesToDelete.push(tokenId);
    }
  }

  for (const tokenId of entriesToDelete) {
    inMemoryBlacklist.delete(tokenId);
  }

  if (entriesToDelete.length > 0) {
    logger.debug('Cleaned up expired blacklist entries', {
      count: entriesToDelete.length,
    });
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupInMemoryBlacklist, 5 * 60 * 1000);
}
