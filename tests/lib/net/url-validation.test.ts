import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isSaasMode: vi.fn(),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock('../../../lib/features', () => ({ isSaasMode: mocks.isSaasMode }));

vi.mock('dns', () => ({
  default: {
    promises: { resolve4: mocks.resolve4, resolve6: mocks.resolve6, lookup: mocks.lookup },
  },
  promises: { resolve4: mocks.resolve4, resolve6: mocks.resolve6, lookup: mocks.lookup },
}));

import {
  outboundPolicy,
  resolveTarget,
  isPrivateIP,
  BlockedUrlError,
} from '../../../lib/net/url-validation';

describe('outboundPolicy', () => {
  it('is strict in SaaS mode', () => {
    mocks.isSaasMode.mockReturnValue(true);

    expect(outboundPolicy()).toEqual({
      requireHttps: true,
      allowedPorts: [443],
      blockPrivateAddresses: true,
    });
  });

  it('is permissive self-hosted, so LAN services stay reachable', () => {
    mocks.isSaasMode.mockReturnValue(false);

    expect(outboundPolicy()).toEqual({
      requireHttps: false,
      allowedPorts: null,
      blockPrivateAddresses: false,
    });
  });
});

const strict = { requireHttps: true, allowedPorts: [443], blockPrivateAddresses: true } as const;
const loose = { requireHttps: false, allowedPorts: null, blockPrivateAddresses: false } as const;

describe('resolveTarget', () => {
  beforeEach(() => {
    mocks.resolve4.mockReset();
    mocks.resolve6.mockReset();
    mocks.lookup.mockReset();
    mocks.resolve4.mockResolvedValue(['93.184.216.34']);
    mocks.resolve6.mockRejectedValue(new Error('no AAAA'));
    // Only reached when both resolve4 and resolve6 come back empty. Rejecting
    // by default keeps every existing test, which only exercises the plain
    // DNS path, from silently depending on this fallback succeeding.
    mocks.lookup.mockRejectedValue(new Error('ENOTFOUND'));
  });

  it('rejects a non-HTTP protocol in every mode', async () => {
    await expect(resolveTarget('file:///etc/passwd', loose)).rejects.toBeInstanceOf(BlockedUrlError);
    await expect(resolveTarget('gopher://x.test/', loose)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('rejects a malformed URL', async () => {
    await expect(resolveTarget('not a url', loose)).rejects.toBeInstanceOf(BlockedUrlError);
  });

  it('rejects plain HTTP when the policy requires HTTPS', async () => {
    await expect(resolveTarget('http://example.test/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('rejects a port outside the allowlist', async () => {
    await expect(resolveTarget('https://example.test:8443/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('allows any port when the policy has no allowlist', async () => {
    const target = await resolveTarget('http://ntfy.lan:8080/topic', loose);

    expect(target.port).toBe(8080);
  });

  it('pins the resolved address for a public hostname', async () => {
    const target = await resolveTarget('https://example.test/hook', strict);

    expect(target.address).toBe('93.184.216.34');
    expect(target.family).toBe(4);
    expect(target.port).toBe(443);
    expect(target.parsed.hostname).toBe('example.test');
  });

  it('rejects a hostname that resolves to a private address', async () => {
    mocks.resolve4.mockResolvedValue(['10.0.0.5']);

    await expect(resolveTarget('https://internal.test/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('rejects when ANY resolved address is private, not just the first', async () => {
    mocks.resolve4.mockResolvedValue(['93.184.216.34', '169.254.169.254']);

    await expect(resolveTarget('https://mixed.test/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('rejects a private address reached over IPv6', async () => {
    mocks.resolve4.mockRejectedValue(new Error('no A'));
    mocks.resolve6.mockResolvedValue(['fd00::1']);

    await expect(resolveTarget('https://v6.test/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('rejects localhost by name under a blocking policy', async () => {
    await expect(resolveTarget('https://localhost/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('rejects a raw private IP literal without a DNS lookup', async () => {
    await expect(resolveTarget('https://127.0.0.1/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
    expect(mocks.resolve4).not.toHaveBeenCalled();
  });

  it('allows a raw private IP self-hosted, and does not look it up', async () => {
    const target = await resolveTarget('http://192.168.1.50:8080/topic', loose);

    expect(target.address).toBe('192.168.1.50');
    expect(mocks.resolve4).not.toHaveBeenCalled();
  });

  it('fails when the hostname does not resolve at all', async () => {
    mocks.resolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mocks.resolve6.mockRejectedValue(new Error('ENOTFOUND'));

    await expect(resolveTarget('https://nope.test/hook', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });

  it('falls back to the hosts-file-aware lookup when plain DNS finds nothing, and still pins the result', async () => {
    // A Docker Compose extra_hosts entry, another /etc/hosts mapping, or an
    // mDNS .local name: none of these have A/AAAA records, but dns.lookup
    // (libuv getaddrinfo) resolves them the same way curl or a browser on
    // the same host would.
    mocks.resolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mocks.resolve6.mockRejectedValue(new Error('ENOTFOUND'));
    mocks.lookup.mockResolvedValue([{ address: '203.0.113.9', family: 4 }]);

    const target = await resolveTarget('https://nas.local/topic', loose);

    expect(target.address).toBe('203.0.113.9');
    expect(target.family).toBe(4);
  });

  it('rejects a private address discovered only through the hosts-file fallback', async () => {
    mocks.resolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mocks.resolve6.mockRejectedValue(new Error('ENOTFOUND'));
    mocks.lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);

    // Asserted on `reason` rather than just BlockedUrlError, so this only
    // stays green when the fallback's result was actually checked against
    // the private-address policy. A build that fell through to "could not
    // resolve" without ever inspecting the looked-up address would raise the
    // same error class with reason 'dns' instead, and would wrongly pass a
    // looser assertion.
    await expect(resolveTarget('https://nas.local/topic', strict)).rejects.toMatchObject({
      reason: 'policy',
    });
  });

  it('does not fall back to dns.lookup when a plain DNS record was already found', async () => {
    await resolveTarget('https://example.test/hook', strict);

    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  // These drive the real resolveTarget against the real strict policy object,
  // with no dns mocking involved: every URL below is a literal address, so
  // resolveTarget takes the no-DNS-lookup branch and hands isPrivateIP the
  // address exactly as parsed.hostname produced it. Before the fix, isPrivateIP
  // only recognised the loopback-dotted spelling of an IPv4-mapped IPv6
  // address (::ffff:127.0.0.1) and missed the plain-hex spelling
  // (::ffff:7f00:1) that the same address can also be written as, so each of
  // these got pinned and connected to instead of rejected.
  describe('SSRF bypass regression: IPv4-mapped and related IPv6 literals', () => {
    const bypassUrls = [
      'https://[::ffff:7f00:1]/topic', // 127.0.0.1, loopback, hex form
      'https://[::ffff:a00:1]/topic', // 10.0.0.1, private, hex form
      'https://[::ffff:c0a8:101]/topic', // 192.168.1.1, private, hex form
      'https://[::ffff:a9fe:a9fe]/topic', // 169.254.169.254, cloud metadata
      'https://[::]/topic', // unspecified, embeds 0.0.0.0
      'https://[0:0:0:0:0:ffff:7f00:1]/topic', // 127.0.0.1, fully expanded
      'https://100.64.1.1/topic', // CGNAT, previously not checked at all
    ];

    it.each(bypassUrls)('rejects %s under the strict SaaS policy', async (url) => {
      await expect(resolveTarget(url, strict)).rejects.toBeInstanceOf(BlockedUrlError);
    });
  });

  it('still rejects the dotted-quad IPv4-mapped spelling (::ffff:127.0.0.1) that already worked', async () => {
    await expect(resolveTarget('https://[::ffff:127.0.0.1]/topic', strict)).rejects.toBeInstanceOf(
      BlockedUrlError
    );
  });
});

describe('isPrivateIP', () => {
  // The bug this whole file exists to close: string-matching one spelling of
  // an address (a prefix regex, a specific expansion) and not another lets an
  // attacker pick the spelling the check does not recognise. This states the
  // required property directly, rather than pinning individual examples,
  // so any future spelling gap trips this test even if nobody thought to add
  // a dedicated case for it.
  describe('equivalence: every spelling of the same address gets the same verdict', () => {
    const groups: Array<{ name: string; addresses: string[]; expected: boolean }> = [
      {
        name: 'loopback (127.0.0.1)',
        addresses: [
          '127.0.0.1',
          '::ffff:127.0.0.1',
          '::ffff:7f00:1',
          '0:0:0:0:0:ffff:7f00:1',
          '::7f00:1', // deprecated IPv4-compatible form
        ],
        expected: true,
      },
      {
        name: 'private class A (10.0.0.1)',
        addresses: ['10.0.0.1', '::ffff:10.0.0.1', '::ffff:a00:1'],
        expected: true,
      },
      {
        name: 'private class C (192.168.1.1)',
        addresses: ['192.168.1.1', '::ffff:192.168.1.1', '::ffff:c0a8:101'],
        expected: true,
      },
      {
        name: 'cloud metadata (169.254.169.254)',
        addresses: ['169.254.169.254', '::ffff:169.254.169.254', '::ffff:a9fe:a9fe'],
        expected: true,
      },
      {
        name: 'unspecified (0.0.0.0 and ::)',
        addresses: ['0.0.0.0', '::', '::0.0.0.0'],
        expected: true,
      },
      {
        name: 'public IPv4 (93.184.216.34)',
        addresses: ['93.184.216.34', '::ffff:93.184.216.34', '::ffff:5db8:d822'],
        expected: false,
      },
    ];

    for (const { name, addresses, expected } of groups) {
      it(`${name}: all spellings are ${expected ? 'private' : 'public'}`, () => {
        for (const address of addresses) {
          expect(isPrivateIP(address)).toBe(expected);
        }
      });
    }
  });

  it('keeps existing IPv6 private ranges working unchanged', () => {
    expect(isPrivateIP('::1')).toBe(true);
    expect(isPrivateIP('fe80::1')).toBe(true);
    expect(isPrivateIP('fe80::a1b2:c3d4')).toBe(true);
    expect(isPrivateIP('fc00::1')).toBe(true);
    expect(isPrivateIP('fd12:3456:789a::1')).toBe(true);
    // fe7f::/16 and fec0::/10 sit just outside fe80::/10 and must stay public.
    expect(isPrivateIP('fe7f::1')).toBe(false);
    expect(isPrivateIP('fec0::1')).toBe(false);
  });

  it('rejects the newly added IPv4 ranges', () => {
    // 100.64.0.0/10, carrier-grade NAT
    expect(isPrivateIP('100.64.0.0')).toBe(true);
    expect(isPrivateIP('100.100.100.100')).toBe(true);
    expect(isPrivateIP('100.127.255.255')).toBe(true);
    expect(isPrivateIP('100.63.255.255')).toBe(false);
    expect(isPrivateIP('100.128.0.0')).toBe(false);

    // 192.0.0.0/24, IETF protocol assignments
    expect(isPrivateIP('192.0.0.1')).toBe(true);
    expect(isPrivateIP('192.0.0.255')).toBe(true);
    expect(isPrivateIP('192.0.1.1')).toBe(false);

    // 224.0.0.0/4, multicast
    expect(isPrivateIP('224.0.0.1')).toBe(true);
    expect(isPrivateIP('239.255.255.255')).toBe(true);
    expect(isPrivateIP('223.255.255.255')).toBe(false);

    // 240.0.0.0/4, reserved, including the broadcast address. 224-255 is
    // fully covered between multicast and reserved, so the only outside
    // boundary is below 224, already covered by the multicast case above.
    expect(isPrivateIP('240.0.0.1')).toBe(true);
    expect(isPrivateIP('255.255.255.255')).toBe(true);
  });

  it('still allows public addresses (regression)', () => {
    expect(isPrivateIP('93.184.216.34')).toBe(false);
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });

  it('does not treat a bare hostname as an IP', () => {
    expect(isPrivateIP('example.test')).toBe(false);
    expect(isPrivateIP('not-an-ip')).toBe(false);
  });
});
