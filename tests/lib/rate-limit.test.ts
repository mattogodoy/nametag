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

      // No trusted IP means the shared fallback, whose ceiling is widened
      // (SHARED_BUCKET_MULTIPLIER) so that one caller cannot deny login
      // instance-wide with a handful of requests.
      const { buildRateLimitKey, maxAttemptsForKey } = await import('@/lib/rate-limit');
      const ceiling = maxAttemptsForKey('login', buildRateLimitKey('login', null, undefined));

      for (let i = 0; i < ceiling; i++) {
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
      //
      // The shared bucket is deliberately much wider than the per-IP one
      // (see SHARED_BUCKET_MULTIPLIER), so exhausting it takes the widened
      // ceiling rather than login's nominal 5. That width is the fix for
      // GHSA-qwj2-9jr7-f273; the sharing itself is still the point here.
      const { maxAttemptsForKey, buildRateLimitKey } = await import('@/lib/rate-limit');
      const ceiling = maxAttemptsForKey('login', buildRateLimitKey('login', null, undefined));

      for (let i = 0; i < ceiling; i++) {
        checkRateLimit(requestWithChain('10.0.0.1'), 'login');
      }

      const result = checkRateLimit(requestWithChain('10.0.0.2'), 'login');
      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
      expect(ceiling).toBeGreaterThan(rateLimitConfigs.login.maxAttempts);
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

      expect(key).toBe('forgotPassword:id:user@example.com');
      expect(key).not.toContain('shared');
    });

    it('keys on the identifier ALONE even when a trusted IP is available', async () => {
      // The property the auth routes document: "an attacker who rotates the
      // client IP still shares a bucket with every other request for the
      // same address". That is only true if the IP is absent from the key.
      //
      // Catches the original implementation, which returned
      // `${type}:${ip}:${identifier}` whenever an IP was available. Under
      // that version these two keys differ, so an attacker with a proxy pool
      // got a fresh bucket per source IP and there was no per-address bound
      // at all in the recommended (proxied) deployment.
      const { buildRateLimitKey } = await import('@/lib/rate-limit');

      const fromOneIp = buildRateLimitKey('forgotPassword', '203.0.113.1', 'victim@example.com');
      const fromAnotherIp = buildRateLimitKey('forgotPassword', '198.51.100.7', 'victim@example.com');

      expect(fromOneIp).toBe(fromAnotherIp);
      expect(fromOneIp).not.toContain('203.0.113.1');
      expect(fromOneIp).not.toContain('198.51.100.7');
    });

    it('namespaces identifier buckets so an IP-shaped identifier cannot collide with an IP bucket', async () => {
      // Catches dropping the `id:` segment. Without it, an attacker who can
      // choose an identifier (an email local part is not the only such
      // surface) could pick one spelled exactly like a victim's IP address
      // and land in the victim's bucket, or vice versa.
      const { buildRateLimitKey } = await import('@/lib/rate-limit');

      const ipBucket = buildRateLimitKey('forgotPassword', '203.0.113.9');
      const identifierBucket = buildRateLimitKey('forgotPassword', null, '203.0.113.9');

      expect(ipBucket).not.toBe(identifierBucket);
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

      expect(key).toMatch(/^login:shared:/);
    });

    it('scopes the shared fallback per process, so one instance cannot deny the fleet', async () => {
      // GHSA-qwj2-9jr7-f273. With the Redis limiter a single global
      // `login:shared` key is shared by every instance behind the load
      // balancer, so one caller exhausting it denies login fleet-wide. The
      // process suffix caps the blast radius at the instance that served
      // those requests.
      //
      // Catches: dropping the suffix. Under that version these two keys, from
      // what are effectively two processes, are identical.
      vi.resetModules();
      const first = await import('@/lib/rate-limit');
      const keyFromFirstProcess = first.buildRateLimitKey('login', null, undefined);

      vi.resetModules();
      const second = await import('@/lib/rate-limit');
      const keyFromSecondProcess = second.buildRateLimitKey('login', null, undefined);

      expect(keyFromFirstProcess).not.toBe(keyFromSecondProcess);
    });

    it('widens the ceiling only for the shared fallback, never for a real partition', async () => {
      // The widening exists because the shared bucket cannot distinguish
      // callers at all. A per-IP or per-identifier bucket can, so it must
      // keep its configured limit; widening those would weaken every
      // correctly configured deployment to fix one that is not.
      const { buildRateLimitKey, maxAttemptsForKey, rateLimitConfigs } = await import(
        '@/lib/rate-limit'
      );

      const shared = buildRateLimitKey('login', null, undefined);
      const perIp = buildRateLimitKey('login', '203.0.113.7');
      const perIdentifier = buildRateLimitKey('login', null, 'user@example.com');

      expect(maxAttemptsForKey('login', shared)).toBeGreaterThan(
        rateLimitConfigs.login.maxAttempts
      );
      expect(maxAttemptsForKey('login', perIp)).toBe(rateLimitConfigs.login.maxAttempts);
      expect(maxAttemptsForKey('login', perIdentifier)).toBe(rateLimitConfigs.login.maxAttempts);
    });
  });

  describe('warnNoTrustedClientIp integration', () => {
    const originalTrustedProxyCount = process.env.TRUSTED_PROXY_COUNT;
    const originalTrustedProxyHeader = process.env.TRUSTED_PROXY_HEADER;

    afterEach(() => {
      if (originalTrustedProxyCount === undefined) {
        delete process.env.TRUSTED_PROXY_COUNT;
      } else {
        process.env.TRUSTED_PROXY_COUNT = originalTrustedProxyCount;
      }

      if (originalTrustedProxyHeader === undefined) {
        delete process.env.TRUSTED_PROXY_HEADER;
      } else {
        process.env.TRUSTED_PROXY_HEADER = originalTrustedProxyHeader;
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

    it('fires the same warning, not a silently trusted value, when an x-real-ip-only proxy is left in the default header mode', async () => {
      // The misconfiguration scenario from the security review: the proxy
      // in front only manages x-real-ip (a real, common setup), but
      // TRUSTED_PROXY_HEADER is left at its default of x-forwarded-for. A
      // genuine client sends no x-forwarded-for of its own (browsers do not
      // set this header), so the app has nothing to read in the mode it is
      // configured for, and must fail into the shared bucket with a loud
      // warning rather than silently trusting x-real-ip (which would only
      // be correct if the operator had actually declared that mode).
      process.env.TRUSTED_PROXY_COUNT = '1';
      delete process.env.TRUSTED_PROXY_HEADER;
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { checkRateLimit } = await import('@/lib/rate-limit');

      const request = new Request('http://localhost/api/test', {
        headers: { 'x-real-ip': '203.0.113.9' },
      });
      const result = checkRateLimit(request, 'login');

      expect(result).toBeNull(); // first request in the shared bucket, still allowed
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('TRUSTED_PROXY_HEADER');

      warnSpy.mockRestore();
    });

    it('fires the warning, not a silently trusted value, when cf-connecting-ip mode is configured but the header is absent', async () => {
      // cf-connecting-ip mode has no chain to fall back on: if Cloudflare
      // (or whatever set TRUSTED_PROXY_HEADER=cf-connecting-ip) did not
      // attach the header, there is nothing else in this mode to read, and
      // the request must fail into the shared bucket with a warning rather
      // than silently trying x-forwarded-for or x-real-ip instead.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { checkRateLimit } = await import('@/lib/rate-limit');

      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.9',
          'x-real-ip': '203.0.113.9',
        },
      });
      const result = checkRateLimit(request, 'login');

      expect(result).toBeNull(); // first request in the shared bucket, still allowed
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain('TRUSTED_PROXY_HEADER');

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

describe('per-email ceilings on unauthenticated mail-sending endpoints', () => {
  it('gives the email bucket more headroom than the IP bucket it sits behind', async () => {
    // The IP bucket does the ordinary work; the email bucket exists only to
    // bound what no IP-scoped limit can, an attacker with a proxy pool
    // mail-bombing one address.
    //
    // It has to be looser, because keying on the address means exhausting it
    // also locks the owner of that address out for the window. Setting it at
    // or below the IP allowance would let one attacker deny a specific person
    // registration or a verification resend for the cost of a handful of
    // requests. At this ratio a real person is stopped by their own IP bucket
    // long before reaching it, and an attacker has to actually send that many
    // emails to the victim to get there.
    const { rateLimitConfigs } = await import('@/lib/rate-limit');

    for (const [ipKey, emailKey] of [
      ['register', 'registerPerEmail'],
      ['forgotPassword', 'forgotPasswordPerEmail'],
      ['resendVerification', 'resendVerificationPerEmail'],
    ] as const) {
      expect(rateLimitConfigs[emailKey].maxAttempts).toBeGreaterThan(
        rateLimitConfigs[ipKey].maxAttempts
      );
      // Same window, so the two are directly comparable rather than one being
      // looser only because it measures over longer.
      expect(rateLimitConfigs[emailKey].windowMs).toBe(rateLimitConfigs[ipKey].windowMs);
    }
  });

  it('keeps two different addresses in separate buckets', async () => {
    // Without this an attacker exhausting one address would take out every
    // other address on the same endpoint.
    const { buildRateLimitKey } = await import('@/lib/rate-limit');

    expect(buildRateLimitKey('registerPerEmail', null, 'a@example.com')).not.toBe(
      buildRateLimitKey('registerPerEmail', null, 'b@example.com')
    );
  });
});
