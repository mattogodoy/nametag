import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * These tests exercise `resolveTrustedClientIp`, the function that decides
 * which entry in a proxy-set header is safe to use for a security decision
 * (rate limiting, in this codebase). Each test names the mutation of the
 * resolver it would catch if that mutation were reintroduced.
 */

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers });
}

async function freshClientIp() {
  vi.resetModules();
  return import('@/lib/net/client-ip');
}

describe('resolveTrustedClientIp', () => {
  const originalTrustedProxyCount = process.env.TRUSTED_PROXY_COUNT;

  afterEach(() => {
    if (originalTrustedProxyCount === undefined) {
      delete process.env.TRUSTED_PROXY_COUNT;
    } else {
      process.env.TRUSTED_PROXY_COUNT = originalTrustedProxyCount;
    }
  });

  describe('the spoofing vulnerability (GHSA-x7jp-pjg9-x996)', () => {
    it('resolves the rightmost entry, not the attacker-supplied leftmost one', async () => {
      // Catches: reverting to `forwardedFor.split(',')[0]` (leftmost entry).
      // This is the exact vulnerability: a client can set x-forwarded-for to
      // "anything, <real ip>" and a leftmost read would trust "anything".
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
      expect(resolveTrustedClientIp(request)).not.toBe('1.2.3.4');
    });

    it('does not change when the attacker rotates the spoofed prefix', async () => {
      // Catches: any implementation that derives the bucket key from
      // anything other than the fixed-position rightmost entry, e.g. hashing
      // the whole header or reading a variable-length prefix.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const first = resolveTrustedClientIp(
        requestWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })
      );
      const second = resolveTrustedClientIp(
        requestWith({ 'x-forwarded-for': '9.9.9.9, 203.0.113.9' })
      );
      const third = resolveTrustedClientIp(
        requestWith({ 'x-forwarded-for': 'not-even-an-ip, 203.0.113.9' })
      );

      expect(first).toBe('203.0.113.9');
      expect(second).toBe('203.0.113.9');
      expect(third).toBe('203.0.113.9');
    });
  });

  describe('TRUSTED_PROXY_COUNT = 0', () => {
    it('ignores x-forwarded-for entirely', async () => {
      // Catches: falling through to header parsing when the count is 0
      // instead of returning null immediately.
      process.env.TRUSTED_PROXY_COUNT = '0';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('ignores x-real-ip entirely', async () => {
      // Catches: consulting x-real-ip unconditionally instead of gating it
      // on trustedProxyCount >= 1.
      process.env.TRUSTED_PROXY_COUNT = '0';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe('fewer hops than TRUSTED_PROXY_COUNT', () => {
    it('returns null rather than falling back to the leftmost entry', async () => {
      // Catches: clamping a negative index to 0 (or to the leftmost entry)
      // instead of returning null. That fallback would hand back exactly
      // the attacker-controlled value this function must refuse.
      process.env.TRUSTED_PROXY_COUNT = '2';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('resolves correctly once enough hops are present', async () => {
      process.env.TRUSTED_PROXY_COUNT = '2';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '1.2.3.4, 203.0.113.9, 198.51.100.7',
      });

      // length 3, count 2 -> index 1 -> '203.0.113.9'
      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });
  });

  describe('non-IP values', () => {
    it('rejects a non-IP candidate from x-forwarded-for', async () => {
      // Catches: skipping the net.isIP validation on the resolved candidate.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': 'definitely-not-an-ip' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('rejects a non-IP value in x-real-ip', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': 'also-not-an-ip' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe('x-real-ip fallback', () => {
    it('is used only when x-forwarded-for is absent', async () => {
      // Catches: preferring x-real-ip over a present x-forwarded-for, or
      // merging the two.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '203.0.113.9',
        'x-real-ip': '198.51.100.7',
      });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });

    it('is used when x-forwarded-for is absent and the count is at least 1', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '198.51.100.7' });

      expect(resolveTrustedClientIp(request)).toBe('198.51.100.7');
    });

    it('is not consulted at all when the count is 0, even alone', async () => {
      process.env.TRUSTED_PROXY_COUNT = '0';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '198.51.100.7' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe('no headers at all', () => {
    it('returns null rather than a placeholder string', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = new Request('http://localhost/api/test');

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe('default TRUSTED_PROXY_COUNT', () => {
    it('defaults to 1 when unset', async () => {
      delete process.env.TRUSTED_PROXY_COUNT;
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });
  });
});

describe('getClientIp (logging only)', () => {
  it('never throws and always returns a string, even for garbage input', async () => {
    const { getClientIp } = await import('@/lib/net/client-ip');
    const request = requestWith({ 'x-forwarded-for': 'garbage, more-garbage' });

    expect(getClientIp(request)).toBe('garbage');
  });
});

describe('warnNoTrustedClientIp', () => {
  it('logs at most once per process, not once per call', async () => {
    // Catches: dropping the `warnedMissingTrustedIp` guard and logging on
    // every call, which is the per-request log spam this function exists to
    // avoid.
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const mod = await import('@/lib/net/client-ip');

    mod.warnNoTrustedClientIp();
    mod.warnNoTrustedClientIp();
    mod.warnNoTrustedClientIp();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});
