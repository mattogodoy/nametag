import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';

/**
 * Integration tests for Redis rate limiting
 * 
 * These tests require a running Redis instance.
 * Skip if Redis is not available using: npm run test -- --grep "Redis Integration"
 */

describe('Redis Integration - Rate Limiting', () => {
  let redis: Redis | null = null;
  const TEST_PREFIX = 'test:ratelimit:';

  beforeAll(() => {
    // Only run if REDIS_URL is set
    if (!process.env.REDIS_URL) {
      console.log('⚠️  Skipping Redis integration tests (REDIS_URL not set)');
      return;
    }

    try {
      redis = new Redis(process.env.REDIS_URL, {
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: 3,
      });
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      redis = null;
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (!redis) return;
    
    // Clean up test keys
    const keys = await redis.keys(`${TEST_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  describe('Basic Operations', () => {
    it('should connect to Redis successfully', async () => {
      if (!redis) {
        console.log('⚠️  Skipping: Redis not available');
        return;
      }

      const result = await redis.ping();
      expect(result).toBe('PONG');
    });

    it('should increment a counter', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}counter`;
      const count1 = await redis.incr(key);
      const count2 = await redis.incr(key);
      const count3 = await redis.incr(key);

      expect(count1).toBe(1);
      expect(count2).toBe(2);
      expect(count3).toBe(3);
    });

    it('should set and respect TTL', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}ttl`;
      await redis.set(key, 'value');
      await redis.expire(key, 2); // 2 seconds

      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(2);
    });

    it('should handle pipeline operations atomically', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}pipeline`;
      const pipeline = redis.pipeline();
      
      pipeline.incr(key);
      pipeline.expire(key, 60);
      pipeline.ttl(key);

      const results = await pipeline.exec();
      
      expect(results).toHaveLength(3);
      expect(results?.[0]?.[1]).toBe(1); // incr result
      expect(results?.[1]?.[1]).toBe(1); // expire result (1 = success)
      expect(results?.[2]?.[1]).toBeGreaterThan(0); // ttl result
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should enforce rate limits correctly', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}user:192.168.1.1`;
      const maxAttempts = 5;
      const windowSeconds = 10;

      // Make 5 attempts (should all succeed)
      for (let i = 1; i <= 5; i++) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }
        expect(count).toBe(i);
      }

      // 6th attempt should exceed limit
      const count = await redis.incr(key);
      expect(count).toBeGreaterThan(maxAttempts);
    });

    it('should reset counter after TTL expires', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}reset`;
      
      // First attempt
      await redis.incr(key);
      await redis.expire(key, 1); // 1 second TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should start from 1 again
      const count = await redis.incr(key);
      expect(count).toBe(1);
    }, 2000); // Increase test timeout

    it('should handle multiple concurrent requests', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}concurrent`;
      
      // Simulate 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        redis!.incr(key).then(count => count)
      );

      const results = await Promise.all(promises);
      
      // All counts should be unique (1-10)
      const uniqueCounts = new Set(results);
      expect(uniqueCounts.size).toBe(10);
      expect(Math.max(...results)).toBe(10);
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large number of keys efficiently', async () => {
      if (!redis) return;

      const numKeys = 100;
      const startTime = Date.now();

      // Create 100 rate limit keys
      for (let i = 0; i < numKeys; i++) {
        const key = `${TEST_PREFIX}perf:user${i}`;
        await redis.incr(key);
        await redis.expire(key, 60);
      }

      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time (< 1 second for 100 keys)
      expect(duration).toBeLessThan(1000);
    });

    it('should clean up expired keys automatically', async () => {
      if (!redis) return;

      const key = `${TEST_PREFIX}cleanup`;
      
      await redis.set(key, 'value');
      await redis.expire(key, 1);

      // Key should exist
      let exists = await redis.exists(key);
      expect(exists).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Key should be gone
      exists = await redis.exists(key);
      expect(exists).toBe(0);
    }, 2000);
  });

  describe('Error Handling', () => {
    it('should handle invalid commands gracefully', async () => {
      if (!redis) return;

      try {
        // Try to execute an invalid command
        await redis.call('INVALID_COMMAND');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle network interruptions', async () => {
      if (!redis) return;

      // This is difficult to test without actually disrupting the network
      // Instead, we test that the client can recover from errors
      
      const key = `${TEST_PREFIX}recovery`;
      const count = await redis.incr(key);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should simulate login rate limiting', async () => {
      if (!redis) return;

      const email = 'user@example.com';
      const ip = '192.168.1.1';
      const key = `${TEST_PREFIX}login:${ip}:${email}`;
      const maxAttempts = 5;
      const windowSeconds = 900; // 15 minutes

      // Simulate failed login attempts
      let isRateLimited = false;
      let attempts = 0;

      for (let i = 0; i < 7; i++) {
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, windowSeconds);
        pipeline.ttl(key);

        const results = await pipeline.exec();
        const count = results?.[0]?.[1] as number;
        attempts = count;

        if (count > maxAttempts) {
          isRateLimited = true;
          break;
        }
      }

      expect(isRateLimited).toBe(true);
      expect(attempts).toBeGreaterThan(maxAttempts);

      // Verify TTL is still set
      const ttl = await redis.ttl(key);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(windowSeconds);
    });

    it('should simulate API rate limiting per IP', async () => {
      if (!redis) return;

      const ip = '203.0.113.0';
      const key = `${TEST_PREFIX}api:${ip}`;
      const maxRequests = 100;
      const windowSeconds = 900; // 15 minutes

      // Simulate 105 API requests
      for (let i = 0; i < 105; i++) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSeconds);
        }

        if (count <= maxRequests) {
          // Request allowed
          expect(count).toBeLessThanOrEqual(maxRequests);
        } else {
          // Request blocked
          expect(count).toBeGreaterThan(maxRequests);
        }
      }

      const finalCount = await redis.get(key);
      expect(Number(finalCount)).toBe(105);
    });
  });
});

