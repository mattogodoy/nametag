import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createModuleLogger: vi.fn(() => mockLog),
}));

vi.mock('@/lib/api-tokens', () => ({ resolveApiToken: vi.fn() }));

import { withAuth, apiResponse } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { resolveApiToken } from '@/lib/api-tokens';

function makeRequest(method: string, token?: string) {
  return new Request('http://localhost/api/people', {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe('withAuth — API token (Bearer) auth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('authenticates a valid bearer token and calls the handler', async () => {
    vi.mocked(resolveApiToken).mockResolvedValue({
      userId: 'u1',
      scope: 'READ_WRITE',
      tokenId: 't1',
    });
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));

    const res = await withAuth(handler)(makeRequest('GET', 'ntag_abc'));

    expect(resolveApiToken).toHaveBeenCalledWith('ntag_abc');
    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][1].user.id).toBe('u1');
    expect(res.status).toBe(200);
    // The cookie path must be skipped entirely for bearer requests.
    expect(auth).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid or expired bearer token', async () => {
    vi.mocked(resolveApiToken).mockResolvedValue(null);
    const handler = vi.fn();

    const res = await withAuth(handler)(makeRequest('GET', 'ntag_bad'));

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('allows GET for a read-only token', async () => {
    vi.mocked(resolveApiToken).mockResolvedValue({
      userId: 'u1',
      scope: 'READ',
      tokenId: 't1',
    });
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));

    const res = await withAuth(handler)(makeRequest('GET', 'ntag_ro'));

    expect(handler).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('forbids mutating methods for a read-only token (403)', async () => {
    vi.mocked(resolveApiToken).mockResolvedValue({
      userId: 'u1',
      scope: 'READ',
      tokenId: 't1',
    });
    const handler = vi.fn();

    const res = await withAuth(handler)(makeRequest('POST', 'ntag_ro'));

    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(403);
  });

  it('ignores bearer auth when allowApiToken is false', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const handler = vi.fn();

    const res = await withAuth(handler, { allowApiToken: false })(
      makeRequest('GET', 'ntag_abc')
    );

    expect(resolveApiToken).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toBe(401);
  });

  it('falls back to the cookie session when no bearer header is present', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u9', email: 'a@b.c' },
    } as never);
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));

    const res = await withAuth(handler)(makeRequest('GET'));

    expect(resolveApiToken).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});
