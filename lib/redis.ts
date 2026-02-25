import Redis from 'ioredis';
import { createModuleLogger } from './logger';

const log = createModuleLogger('redis');
import { isSaasMode } from './features';

/**
 * Redis client configuration
 *
 * In development: Falls back to in-memory if Redis not available
 * In production (self-hosted): Falls back to in-memory if Redis not available
 * In SaaS mode: Requires Redis (will throw error if not configured)
 */

let redis: Redis | null = null;
let isRedisAvailable = false;
let connectionPromise: Promise<void> | null = null;

/**
 * Initialize Redis client
 */
function createRedisClient(): Redis | null {
  // If no Redis URL configured and not in SaaS mode, skip Redis
  if (!process.env.REDIS_URL && !isSaasMode()) {
    log.warn('Redis URL not configured. Using in-memory rate limiting (not recommended for multi-instance deployments)');
    return null;
  }

  // In SaaS mode, Redis is required
  if (!process.env.REDIS_URL && isSaasMode()) {
    throw new Error('REDIS_URL is required in SaaS mode for distributed rate limiting');
  }

  try {
    const client = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          log.error('Redis connection failed after 3 retries');
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
      log.info('Redis client connected');
      isRedisAvailable = true;
    });

    client.on('error', (err) => {
      log.error({ err }, 'Redis client error');
      isRedisAvailable = false;
    });

    client.on('close', () => {
      log.warn('Redis connection closed');
      isRedisAvailable = false;
    });

    return client;
  } catch (error) {
    log.error({ err: error as Error }, 'Failed to create Redis client');

    // In SaaS mode, fail fast
    if (isSaasMode()) {
      throw error;
    }

    return null;
  }
}

/**
 * Initialize Redis connection and wait for it to be ready
 */
export async function initRedis(): Promise<void> {
  // If already initialized, return immediately
  if (connectionPromise) {
    return connectionPromise;
  }

  // If already connected, return immediately
  if (isRedisAvailable && redis !== null) {
    return Promise.resolve();
  }

  connectionPromise = new Promise<void>((resolve, reject) => {
    // Create Redis client if not already created
    if (redis === null) {
      redis = createRedisClient();
    }

    // If Redis is disabled (no URL in dev), resolve immediately
    if (redis === null) {
      isRedisAvailable = false;
      resolve();
      return;
    }

    // Set a timeout for connection
    const timeout = setTimeout(() => {
      log.warn('Redis connection timeout after 5 seconds, continuing without Redis');
      isRedisAvailable = false;
      resolve();
    }, 5000);

    // Wait for connection or error
    const onConnect = () => {
      clearTimeout(timeout);
      redis?.off('error', onError);
      isRedisAvailable = true;
      log.info('Redis initialized and ready');
      resolve();
    };

    const onError = (err: Error) => {
      clearTimeout(timeout);
      redis?.off('connect', onConnect);
      isRedisAvailable = false;

      if (isSaasMode()) {
        log.error({ err }, 'Redis connection failed in SaaS mode');
        reject(err);
      } else {
        log.warn('Redis connection failed, continuing without Redis');
        resolve();
      }
    };

    // If already connected (between check and promise creation), resolve immediately
    if (isRedisAvailable) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    // Check if already connected by trying a ping
    redis.ping()
      .then(() => {
        clearTimeout(timeout);
        isRedisAvailable = true;
        log.info('Redis already connected');
        resolve();
      })
      .catch(() => {
        // Not connected yet, wait for connect event
        redis!.once('connect', onConnect);
        redis!.once('error', onError);
      });
  });

  return connectionPromise;
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
    log.info('Redis client disconnected');
  }
}

// Graceful shutdown handlers - guarded to prevent duplicate registration during hot reload
const globalForRedisShutdown = globalThis as unknown as { __redisShutdownRegistered?: boolean };
if (!globalForRedisShutdown.__redisShutdownRegistered) {
  globalForRedisShutdown.__redisShutdownRegistered = true;
  process.on('SIGINT', async () => {
    await disconnectRedis();
  });
  process.on('SIGTERM', async () => {
    await disconnectRedis();
  });
}

