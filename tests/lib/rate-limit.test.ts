import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

    it('does not trust x-real-ip, so a request carrying only it shares the fallback bucket', async () => {
      // x-real-ip is never part of the trusted resolution path (see
      // lib/net/client-ip.ts), so a request with no x-forwarded-for
      // resolves to no trusted IP at all, regardless of x-real-ip, and
      // shares the "no trusted IP" bucket with every other such request
      // for this rate-limit type. This still blocks after maxAttempts, but
      // for a different reason than the old (incorrect) "reads x-real-ip as
      // a fallback" behavior this test used to pin.
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');

      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-real-ip': '10.0.0.10',
        },
      });

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

  describe('trusted proxy resolution (GHSA-x7jp-pjg9-x996 regression)', () => {
    const originalTrustedProxyCount = process.env.TRUSTED_PROXY_COUNT;

    afterEach(() => {
      if (originalTrustedProxyCount === undefined) {
        delete process.env.TRUSTED_PROXY_COUNT;
      } else {
        process.env.TRUSTED_PROXY_COUNT = originalTrustedProxyCount;
      }
    });

    function requestWithChain(chain: string): Request {
      return new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': chain },
      });
    }

    it('does not let an attacker get a fresh bucket by rotating the spoofed prefix', async () => {
      // Catches: reading the leftmost x-forwarded-for entry instead of the
      // rightmost trusted one. Without the fix, each distinct prefix below
      // produces a distinct bucket and none of them would ever see a 429.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');

      const realClientIp = '203.0.113.42';

      // Exhaust the bucket using one spoofed prefix.
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        const result = checkRateLimit(requestWithChain(`1.1.1.1, ${realClientIp}`), 'login');
        expect(result).toBeNull();
      }

      // A "new" attacker request with a different spoofed prefix, but the
      // same real client IP behind it, must already be blocked.
      const blocked = checkRateLimit(requestWithChain(`2.2.2.2, ${realClientIp}`), 'login');
      expect(blocked).not.toBeNull();
      expect(blocked?.status).toBe(429);

      // A genuinely different real client IP is unaffected.
      const otherClient = checkRateLimit(
        requestWithChain(`3.3.3.3, 198.51.100.5`),
        'login'
      );
      expect(otherClient).toBeNull();
    });

    it('falls back to a shared bucket, not the leftmost entry, when TRUSTED_PROXY_COUNT is 0', async () => {
      // Catches: still parsing x-forwarded-for when the count is 0.
      process.env.TRUSTED_PROXY_COUNT = '0';
      const { checkRateLimit, rateLimitConfigs } = await import('@/lib/rate-limit');

      // Two different callers, distinguished only by x-forwarded-for, share
      // the same bucket because no IP is trusted at all with count 0.
      for (let i = 0; i < rateLimitConfigs.login.maxAttempts; i++) {
        checkRateLimit(requestWithChain('10.0.0.1'), 'login');
      }

      const result = checkRateLimit(requestWithChain('10.0.0.2'), 'login');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });
  });

  describe('buildRateLimitKey', () => {
    it('keys on the identifier alone when there is no trusted IP', async () => {
      // Catches: deleting the `if (identifier)` branch, which is the entire
      // reason the auth routes (forgot-password, resend-verification,
      // register) narrow their bucket by email: without it, any request
      // with no trusted IP collapses into the shared bucket regardless of
      // the identifier passed in, silently undoing that fix.
      const { buildRateLimitKey } = await import('@/lib/rate-limit');

      const key = buildRateLimitKey('forgotPassword', null, 'user@example.com');

      expect(key).toBe('forgotPassword:user@example.com');
      expect(key).not.toContain('shared');
    });

    it('still distinguishes two different identifiers when there is no trusted IP', async () => {
      const { buildRateLimitKey } = await import('@/lib/rate-limit');

      const keyA = buildRateLimitKey('forgotPassword', null, 'a@example.com');
      const keyB = buildRateLimitKey('forgotPassword', null, 'b@example.com');

      expect(keyA).not.toBe(keyB);
    });

    it('falls back to a shared bucket only when there is neither a trusted IP nor an identifier', async () => {
      const { buildRateLimitKey } = await import('@/lib/rate-limit');

      const key = buildRateLimitKey('login', null, undefined);

      expect(key).toBe('login:shared');
    });
  });

  describe('warnNoTrustedClientIp integration', () => {
    const originalTrustedProxyCount = process.env.TRUSTED_PROXY_COUNT;

    afterEach(() => {
      if (originalTrustedProxyCount === undefined) {
        delete process.env.TRUSTED_PROXY_COUNT;
      } else {
        process.env.TRUSTED_PROXY_COUNT = originalTrustedProxyCount;
      }
    });

    it('checkRateLimit emits the operator warning when it falls back to the shared bucket', async () => {
      // Catches: deleting the warnNoTrustedClientIp() call from the rate
      // limiter (or from buildRateLimitKey). That call is the only signal
      // an operator gets that TRUSTED_PROXY_COUNT is misconfigured and
      // every unauthenticated request with no other identifier is sharing
      // one bucket; losing it makes that condition silent.
      process.env.TRUSTED_PROXY_COUNT = '0';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { checkRateLimit } = await import('@/lib/rate-limit');

      checkRateLimit(new Request('http://localhost/api/test'), 'login');

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('TRUSTED_PROXY_COUNT');

      warnSpy.mockRestore();
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
