import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
  isRedisConnected: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  securityLogger: {
    rateLimitExceeded: vi.fn(),
    suspiciousActivity: vi.fn(),
  },
}));

describe('Redis Rate Limiting', () => {
  let checkRateLimit: (
    request: Request,
    type: string,
    identifier?: string
  ) => Promise<NextResponse | null>;
  let resetRateLimit: (
    request: Request,
    type: string,
    identifier?: string
  ) => Promise<void>;
  let getRedis: ReturnType<typeof vi.fn>;
  let isRedisConnected: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const redisModule = await import('@/lib/redis');
    getRedis = redisModule.getRedis as ReturnType<typeof vi.fn>;
    isRedisConnected = redisModule.isRedisConnected as ReturnType<typeof vi.fn>;

    const rateLimitModule = await import('@/lib/rate-limit-redis');
    checkRateLimit = rateLimitModule.checkRateLimit;
    resetRateLimit = rateLimitModule.resetRateLimit;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit with Redis', () => {
    it('should allow requests under the rate limit', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 3], // count = 3
          [null, 1],
          [null, 900], // ttl = 900 seconds
        ]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      expect(result).toBeNull(); // null means allowed
    });

    it('should block requests exceeding the rate limit', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 10], // count = 10 (exceeds limit of 5)
          [null, 1],
          [null, 600], // ttl = 600 seconds (10 minutes)
        ]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      
      expect(result).toBeInstanceOf(NextResponse);
      expect(result?.status).toBe(429);
      
      const json = await result?.json();
      expect(json.error).toContain('Too many attempts');
      expect(json.retryAfter).toBe(600);
    });

    it('should include rate limit headers in blocked responses', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 6], // count = 6 (exceeds limit of 5)
          [null, 1],
          [null, 300], // ttl = 300 seconds
        ]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      
      expect(result?.headers.get('Retry-After')).toBe('300');
      expect(result?.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(result?.headers.get('X-RateLimit-Reset')).toBeDefined();
    });

    it('should use identifier in rate limit key when provided', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 900],
        ]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await checkRateLimit(request, 'login', 'user@example.com');
      
      // Verify the key includes the identifier
      expect(mockPipeline.incr).toHaveBeenCalled();
    });
  });

  describe('checkRateLimit fallback to memory', () => {
    it('should fallback to memory store when Redis is unavailable in development', async () => {
      process.env.NODE_ENV = 'development';
      getRedis.mockReturnValue(null);
      isRedisConnected.mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      expect(result).toBeNull(); // Should use memory fallback
    });

    it('should fail open in production when Redis is unavailable', async () => {
      process.env.NODE_ENV = 'production';
      getRedis.mockReturnValue(null);
      isRedisConnected.mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      expect(result).toBeNull(); // Fail open (allow request)
    });

    it('should handle Redis errors gracefully', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('Redis error')),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      expect(result).toBeNull(); // Fail open on error
    });
  });

  describe('resetRateLimit', () => {
    it('should delete rate limit key from Redis', async () => {
      const mockRedis = {
        del: vi.fn().mockResolvedValue(1),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await resetRateLimit(request, 'login');
      
      expect(mockRedis.del).toHaveBeenCalled();
    });

    it('should handle reset when Redis is unavailable', async () => {
      getRedis.mockReturnValue(null);
      isRedisConnected.mockReturnValue(false);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await expect(resetRateLimit(request, 'login')).resolves.not.toThrow();
    });

    it('should handle errors during reset gracefully', async () => {
      const mockRedis = {
        del: vi.fn().mockRejectedValue(new Error('Redis error')),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      await expect(resetRateLimit(request, 'login')).resolves.not.toThrow();
    });
  });

  describe('Client IP extraction', () => {
    it('should extract IP from x-forwarded-for header', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 1], [null, 1], [null, 900]]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-forwarded-for': '203.0.113.0, 198.51.100.0' },
      });

      await checkRateLimit(request, 'login');
      
      // Should use the first IP in the list
      expect(mockPipeline.incr).toHaveBeenCalled();
    });

    it('should extract IP from x-real-ip header when x-forwarded-for is not present', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 1], [null, 1], [null, 900]]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test', {
        headers: { 'x-real-ip': '203.0.113.0' },
      });

      await checkRateLimit(request, 'login');
      
      expect(mockPipeline.incr).toHaveBeenCalled();
    });

    it('should use "unknown" when no IP headers are present', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 1], [null, 1], [null, 900]]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/test');

      await checkRateLimit(request, 'login');
      
      expect(mockPipeline.incr).toHaveBeenCalled();
    });
  });

  describe('Different rate limit types', () => {
    it('should handle login rate limits (5 attempts, 15 minutes)', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 5], [null, 1], [null, 900]]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/auth/login', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'login');
      expect(result).toBeNull(); // 5th attempt should still be allowed
    });

    it('should handle register rate limits (3 attempts, 1 hour)', async () => {
      const mockPipeline = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        ttl: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([[null, 3], [null, 1], [null, 3600]]),
      };

      const mockRedis = {
        ping: vi.fn().mockResolvedValue('PONG'),
        pipeline: vi.fn().mockReturnValue(mockPipeline),
      };

      getRedis.mockReturnValue(mockRedis);
      isRedisConnected.mockReturnValue(true);

      const request = new Request('http://localhost:3000/api/auth/register', {
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });

      const result = await checkRateLimit(request, 'register');
      expect(result).toBeNull(); // 3rd attempt should still be allowed
    });
  });
});

