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

  describe("TRUSTED_PROXY_HEADER = 'x-forwarded-for' (default): x-real-ip is never trusted", () => {
    it('is not used as a fallback when x-forwarded-for is absent, even with a trusted proxy count', async () => {
      // Catches: reintroducing the "consult x-real-ip when x-forwarded-for is
      // absent" fallback in the x-forwarded-for mode. That fallback is
      // exploitable against a proxy that manages x-real-ip (via
      // proxy_set_header, which replaces) but never touches
      // x-forwarded-for: such a proxy passes an attacker's own
      // x-forwarded-for straight through untouched, and a resolver that
      // falls back to x-real-ip only when x-forwarded-for is *absent* would
      // never even notice, because in the exploit case x-forwarded-for is
      // present (it's the attacker's). This test pins the simpler,
      // observable half of that: with no x-forwarded-for at all, a present
      // x-real-ip must not be trusted while in the default header mode.
      // (A deployment that is genuinely behind an x-real-ip-only proxy
      // should instead set TRUSTED_PROXY_HEADER=x-real-ip; see the sibling
      // describe block below for that mode's own tests.)
      process.env.TRUSTED_PROXY_COUNT = '1';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '198.51.100.7' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('does not affect resolution when x-forwarded-for is present, including a spoofed value matching the attacker prefix', async () => {
      // This is the case a Caddy operator's attacker would try: Caddy sets
      // x-forwarded-for and no x-real-ip at all, so an attacker who injects
      // their own x-real-ip header must not be able to influence the
      // result. Catches: any code path that reads, prefers, cross-checks
      // against, or is otherwise influenced by x-real-ip when resolving via
      // x-forwarded-for in the default mode. The correct, rightmost
      // x-forwarded-for entry must win regardless of what x-real-ip says,
      // including when x-real-ip has been set (by the attacker, or
      // coincidentally) to the same value as the spoofed prefix.
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

  describe("TRUSTED_PROXY_HEADER = 'x-real-ip'", () => {
    it('resolves the genuine x-real-ip even when x-forwarded-for is entirely attacker-supplied', async () => {
      // The topology this mode exists for: a proxy that replaces x-real-ip
      // (proxy_set_header, trustworthy) but never manages x-forwarded-for,
      // so every entry in x-forwarded-for, at every position, is whatever
      // the client put there. Catches: still reading x-forwarded-for in
      // this mode (e.g. forgetting to branch on TRUSTED_PROXY_HEADER), which
      // would hand back an attacker-chosen entry instead of the genuine
      // x-real-ip value.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '6.6.6.6, 7.7.7.7',
        'x-real-ip': '203.0.113.9',
      });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });

    it('does not change when the attacker rotates the spoofed x-forwarded-for entries', async () => {
      // Catches: any code path in x-real-ip mode that is influenced, even
      // partially, by x-forwarded-for content. Rotating attacker-controlled
      // entries must have zero effect on the result in this mode.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const first = resolveTrustedClientIp(
        requestWith({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7', 'x-real-ip': '203.0.113.9' })
      );
      const second = resolveTrustedClientIp(
        requestWith({ 'x-forwarded-for': '8.8.8.8', 'x-real-ip': '203.0.113.9' })
      );
      const third = resolveTrustedClientIp(
        requestWith({ 'x-real-ip': '203.0.113.9' }) // no x-forwarded-for at all
      );

      expect(first).toBe('203.0.113.9');
      expect(second).toBe('203.0.113.9');
      expect(third).toBe('203.0.113.9');
    });

    it('resolves an honest client with no x-forwarded-for correctly (the regression this mode exists to fix)', async () => {
      // Before TRUSTED_PROXY_HEADER existed, dropping x-real-ip from the
      // trusted path entirely (to close the Caddy-mirror flaw) broke every
      // honest client behind a genuinely x-real-ip-only proxy: they send no
      // x-forwarded-for of their own, so the app had nothing left to read
      // and fell back to the shared bucket. Catches: this mode failing to
      // actually restore that resolution.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });

    it('rejects a non-IP value', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': 'not-an-ip' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('resolves to null when x-real-ip is absent, rather than falling back to x-forwarded-for', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('still ignores everything when the count is 0, regardless of the header setting', async () => {
      process.env.TRUSTED_PROXY_COUNT = '0';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'x-real-ip': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe("TRUSTED_PROXY_HEADER = 'cf-connecting-ip'", () => {
    it('resolves the genuine cf-connecting-ip, ignoring a spoofed x-forwarded-for and x-real-ip entirely', async () => {
      // Cloudflare overwrites CF-Connecting-IP with the visitor address on
      // every request, but a client reaching Cloudflare can still put
      // whatever it wants in x-forwarded-for and x-real-ip; Cloudflare
      // passes those through to the origin unchanged. Catches: still
      // reading either of those headers in this mode (e.g. forgetting to
      // branch on TRUSTED_PROXY_HEADER, or a copy-paste of the
      // x-forwarded-for or x-real-ip logic), which would hand back an
      // attacker-chosen value instead of the genuine cf-connecting-ip one.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '6.6.6.6, 7.7.7.7',
        'x-real-ip': '8.8.8.8',
        'cf-connecting-ip': '203.0.113.9',
      });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
    });

    it('does not change when the attacker rotates either spoofed header', async () => {
      // Catches: any code path in cf-connecting-ip mode that is influenced,
      // even partially, by x-forwarded-for or x-real-ip content. Rotating
      // either attacker-controlled header must have zero effect on the
      // result in this mode.
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const first = resolveTrustedClientIp(
        requestWith({
          'x-forwarded-for': '6.6.6.6, 7.7.7.7',
          'x-real-ip': '8.8.8.8',
          'cf-connecting-ip': '203.0.113.9',
        })
      );
      const second = resolveTrustedClientIp(
        requestWith({
          'x-forwarded-for': '9.9.9.9',
          'x-real-ip': '10.10.10.10',
          'cf-connecting-ip': '203.0.113.9',
        })
      );
      const third = resolveTrustedClientIp(
        requestWith({ 'cf-connecting-ip': '203.0.113.9' }) // neither spoofed header at all
      );

      expect(first).toBe('203.0.113.9');
      expect(second).toBe('203.0.113.9');
      expect(third).toBe('203.0.113.9');
    });

    it('resolves to null when cf-connecting-ip is absent, rather than falling back to x-forwarded-for or x-real-ip', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '6.6.6.6, 7.7.7.7',
        'x-real-ip': '8.8.8.8',
      });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('rejects a non-IP value', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'cf-connecting-ip': 'not-an-ip' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });

    it('still ignores everything when the count is 0, regardless of the header setting', async () => {
      process.env.TRUSTED_PROXY_COUNT = '0';
      process.env.TRUSTED_PROXY_HEADER = 'cf-connecting-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({ 'cf-connecting-ip': '203.0.113.9' });

      expect(resolveTrustedClientIp(request)).toBeNull();
    });
  });

  describe('cf-connecting-ip is ignored outside cf-connecting-ip mode', () => {
    it('cannot influence resolution in the default (x-forwarded-for) mode', async () => {
      // A Cloudflare-shaped header must not leak into a deployment that
      // never declared itself to be behind Cloudflare. Catches: any shared
      // code path that reads cf-connecting-ip unconditionally instead of
      // only inside resolveFromCfConnectingIp.
      process.env.TRUSTED_PROXY_COUNT = '1';
      delete process.env.TRUSTED_PROXY_HEADER;
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-forwarded-for': '1.2.3.4, 203.0.113.9',
        'cf-connecting-ip': '198.51.100.7',
      });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
      expect(resolveTrustedClientIp(request)).not.toBe('198.51.100.7');
    });

    it('cannot influence resolution in x-real-ip mode', async () => {
      process.env.TRUSTED_PROXY_COUNT = '1';
      process.env.TRUSTED_PROXY_HEADER = 'x-real-ip';
      const { resolveTrustedClientIp } = await freshClientIp();

      const request = requestWith({
        'x-real-ip': '203.0.113.9',
        'cf-connecting-ip': '198.51.100.7',
      });

      expect(resolveTrustedClientIp(request)).toBe('203.0.113.9');
      expect(resolveTrustedClientIp(request)).not.toBe('198.51.100.7');
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
