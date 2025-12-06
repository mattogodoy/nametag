import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('rate-limit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  function createMockRequest(ip: string = '192.168.1.1'): Request {
    return new Request('http://localhost/api/test', {
      headers: {
        'x-forwarded-for': ip,
      },
    });
  }

  describe('checkRateLimit', () => {
    it('should allow first request', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.1');

      const result = checkRateLimit(request, 'login');
      expect(result).toBeNull();
    });

    it('should allow requests within limit', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.2');

      // Make requests up to the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        const result = checkRateLimit(request, 'login');
        expect(result).toBeNull();
      }
    });

    it('should block requests exceeding limit', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.3');

      // Exhaust the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      // Next request should be blocked
      const result = checkRateLimit(request, 'login');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should return 429 with Retry-After header', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.4');

      // Exhaust the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      const result = checkRateLimit(request, 'login');
      expect(result?.headers.get('Retry-After')).toBeTruthy();
    });

    it('should return error message with retry time', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.5');

      // Exhaust the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      const result = checkRateLimit(request, 'login');
      const body = await result?.json();
      expect(body.error).toContain('Too many attempts');
      expect(body.retryAfter).toBeDefined();
    });

    it('should track different IPs separately', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');

      const request1 = createMockRequest('10.0.0.6');
      const request2 = createMockRequest('10.0.0.7');

      // Exhaust limit for IP 1
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request1, 'login');
      }

      // IP 1 should be blocked
      expect(checkRateLimit(request1, 'login')).not.toBeNull();

      // IP 2 should still be allowed
      expect(checkRateLimit(request2, 'login')).toBeNull();
    });

    it('should track different endpoints separately', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.8');

      // Exhaust login limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      // Login should be blocked
      expect(checkRateLimit(request, 'login')).not.toBeNull();

      // Register should still be allowed
      expect(checkRateLimit(request, 'register')).toBeNull();
    });

    it('should use identifier for more granular limiting', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.9');

      // Exhaust limit for email1
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login', 'email1@test.com');
      }

      // email1 should be blocked
      expect(checkRateLimit(request, 'login', 'email1@test.com')).not.toBeNull();

      // email2 should still be allowed
      expect(checkRateLimit(request, 'login', 'email2@test.com')).toBeNull();
    });

    it('should read IP from x-real-ip header as fallback', async () => {
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');

      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.10',
        },
      });

      // Should work without x-forwarded-for
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      expect(checkRateLimit(request, 'login')).not.toBeNull();
    });

    it('should handle missing IP headers', async () => {
      const { checkRateLimit } = await import('@/lib/rate-limit');

      const request = new Request('http://localhost/api/test');

      // Should still work, using 'unknown' as IP
      const result = checkRateLimit(request, 'login');
      expect(result).toBeNull();
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific key', async () => {
      const { checkRateLimit, resetRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.11');

      // Exhaust the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login');
      }

      // Should be blocked
      expect(checkRateLimit(request, 'login')).not.toBeNull();

      // Reset the limit
      resetRateLimit(request, 'login');

      // Should be allowed again
      expect(checkRateLimit(request, 'login')).toBeNull();
    });

    it('should reset rate limit with identifier', async () => {
      const { checkRateLimit, resetRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');
      const request = createMockRequest('10.0.0.12');
      const email = 'test@example.com';

      // Exhaust the limit
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(request, 'login', email);
      }

      // Reset with identifier
      resetRateLimit(request, 'login', email);

      // Should be allowed again
      expect(checkRateLimit(request, 'login', email)).toBeNull();
    });
  });

  describe('rateLimitConfigs', () => {
    it('should have correct login config', async () => {
      const { rateLimitConfigs } = await import('@/lib/rate-limit');
      expect(rateLimitConfigs.login.maxAttempts).toBe(5);
      expect(rateLimitConfigs.login.windowMs).toBe(15 * 60 * 1000);
    });

    it('should have correct register config', async () => {
      const { rateLimitConfigs } = await import('@/lib/rate-limit');
      expect(rateLimitConfigs.register.maxAttempts).toBe(3);
      expect(rateLimitConfigs.register.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct forgotPassword config', async () => {
      const { rateLimitConfigs } = await import('@/lib/rate-limit');
      expect(rateLimitConfigs.forgotPassword.maxAttempts).toBe(3);
      expect(rateLimitConfigs.forgotPassword.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct resetPassword config', async () => {
      const { rateLimitConfigs } = await import('@/lib/rate-limit');
      expect(rateLimitConfigs.resetPassword.maxAttempts).toBe(5);
      expect(rateLimitConfigs.resetPassword.windowMs).toBe(60 * 60 * 1000);
    });

    it('should have correct resendVerification config', async () => {
      const { rateLimitConfigs } = await import('@/lib/rate-limit');
      expect(rateLimitConfigs.resendVerification.maxAttempts).toBe(3);
      expect(rateLimitConfigs.resendVerification.windowMs).toBe(15 * 60 * 1000);
    });
  });
});
