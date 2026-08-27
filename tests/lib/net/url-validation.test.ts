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
});
