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

  });

  describe('x-real-ip is never trusted (a proxy that manages only x-real-ip is a misconfiguration)', () => {
    it('is not used as a fallback when x-forwarded-for is absent, even with a trusted proxy count', async () => {
      // Catches: reintroducing the "consult x-real-ip when x-forwarded-for is
      // absent" fallback. That fallback is exploitable against a proxy that
      // manages x-real-ip (via proxy_set_header, which replaces) but never
      // touches x-forwarded-for: such a proxy passes an attacker's own
      // x-forwarded-for straight through untouched, and a resolver that
      // falls back to x-real-ip only when x-forwarded-for is *absent* would
      // never even notice, because in the exploit case x-forwarded-for is
      // present (it's the attacker's). This test pins the simpler,
      // observable half of that: with no x-forwarded-for at all, a present
      // x-real-ip must not be trusted.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '198.51.100.7' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('does not affect resolution when x-forwarded-for is present, including a spoofed value matching the attacker prefix', async () => {
      // The regression scenario from the security review: a proxy sets a
      // genuine x-real-ip, but the x-forwarded-for chain it forwards has an
      // attacker-supplied entry. Catches: any code path that reads,
      // prefers, cross-checks against, or is otherwise influenced by
      // x-real-ip when resolving via x-forwarded-for. The correct,
      // rightmost x-forwarded-for entry must win regardless of what
      // x-real-ip says, including when x-real-ip has been set (by the
      // attacker, or coincidentally) to the same value as the spoofed
      // prefix.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '6.6.6.6, 203.0.113.9',
        'x-real-ip': '6.6.6.6',
      });

      const result = resolveTrustedClientIp(request);
      expect(result).toBe('203.0.113.9');
      expect(result).not.toBe('6.6.6.6');
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

  describe('IPv6 addresses', () => {
    it('accepts a valid IPv6 candidate', async () => {
      // Catches: replacing net.isIP with an IPv4-only validator (e.g. a
      // dotted-quad regex). There is no other IPv6 coverage in this file,
      // so an IPv4-only check would otherwise pass every test here while
      // quietly rejecting every real IPv6 client into the shared bucket,
      // which is exactly this design's failure mode.
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '2001:db8::1' });

      expect(resolveTrustedClientIp(request)).toBe('2001:db8::1');
    });

    it('resolves the rightmost entry from a chain mixing IPv4 and IPv6 hops', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '1.2.3.4, 2001:db8::9' });

      expect(resolveTrustedClientIp(request)).toBe('2001:db8::9');
    });

    it('rejects a malformed IPv6-looking candidate', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '2001:db8::zzzz' });

      expect(resolveTrustedClientIp(request)).toBeNull();
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
