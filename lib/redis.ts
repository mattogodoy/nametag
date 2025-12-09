import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis client configuration
 * 
 * In development: Falls back to in-memory if Redis not available
 * In production: Requires Redis (will throw error if not configured)
 */

let redis: Redis | null = null;
let isRedisAvailable = false;

/**
 * Initialize Redis client
 */
function createRedisClient(): Redis | null {
  // If no Redis URL configured and in development, skip Redis
  if (!process.env.REDIS_URL && process.env.NODE_ENV !== 'production') {
    logger.warn('Redis URL not configured. Using in-memory rate limiting (not recommended for production)');
    return null;
  }

  // In production, Redis is required
  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    throw new Error('REDIS_URL is required in production for distributed rate limiting');
  }

  try {
    const client = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        if (targetErrors.some(target => err.message.includes(target))) {
          return true; // Reconnect
        }
        return false;
      },
    });

    client.on('connect', () => {
      logger.info('Redis client connected');
      isRedisAvailable = true;
    });

    client.on('error', (err) => {
      logger.error('Redis client error', {}, err);
      isRedisAvailable = false;
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
      isRedisAvailable = false;
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Redis client', {}, error as Error);
    
    // In production, fail fast
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
    
    return null;
  }
}

/**
 * Get Redis client instance (singleton)
 */
export function getRedis(): Redis | null {
  if (redis === null) {
    redis = createRedisClient();
  }
  return redis;
}

/**
 * Check if Redis is available
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && redis !== null;
}

/**
 * Graceful shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    isRedisAvailable = false;
    logger.info('Redis client disconnected');
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await disconnectRedis();
});

process.on('SIGTERM', async () => {
  await disconnectRedis();
});

