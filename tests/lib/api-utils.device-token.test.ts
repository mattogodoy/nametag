import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const mockLog = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createModuleLogger: vi.fn(() => mockLog),
}));
vi.mock('@/lib/api-tokens', () => ({ resolveApiToken: vi.fn() }));
vi.mock('@/lib/native-auth/sessions', () => ({ resolveDeviceAccessToken: vi.fn() }));

import { withAuth, apiResponse } from '@/lib/api-utils';
import { auth } from '@/lib/auth';
import { resolveApiToken } from '@/lib/api-tokens';
import { resolveDeviceAccessToken } from '@/lib/native-auth/sessions';

function makeRequest(method: string, authorization?: string, origin?: string) {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  if (origin) headers.origin = origin;
  return new Request('http://localhost/api/people', { method, headers });
}

describe('withAuth: device session tokens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs the handler as the device user with authMethod and session id', async () => {
    vi.mocked(resolveDeviceAccessToken).mockResolvedValue({ status: 'ok', userId: 'u1', sessionId: 's1' });
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));

    const res = await withAuth(handler)(makeRequest('POST', 'Bearer ntsa_abc', 'https://evil.example'));

    expect(res.status).toBe(200);
    const session = handler.mock.calls[0][1];
    expect(session.user.id).toBe('u1');
    expect(session.authMethod).toBe('device');
    expect(session.deviceSessionId).toBe('s1');
    expect(auth).not.toHaveBeenCalled();
    expect(resolveApiToken).not.toHaveBeenCalled();
  });

  it('is accepted on routes that refuse API tokens (Review Focus 3)', async () => {
    vi.mocked(resolveDeviceAccessToken).mockResolvedValue({ status: 'ok', userId: 'u1', sessionId: 's1' });
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));

    const res = await withAuth(handler, { allowApiTokens: false })(makeRequest('GET', 'Bearer ntsa_abc'));

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('still ignores API tokens on routes that refuse them (Review Focus 3)', async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const handler = vi.fn();

    const res = await withAuth(handler, { allowApiTokens: false })(makeRequest('GET', 'Bearer ntag_abc'));

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(resolveApiToken).not.toHaveBeenCalled();
  });

  it('returns 401 access_token_expired for an expired device token', async () => {
    vi.mocked(resolveDeviceAccessToken).mockResolvedValue({ status: 'expired' });
    const res = await withAuth(vi.fn())(makeRequest('GET', 'Bearer ntsa_old'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('access_token_expired');
  });

  it('returns 401 invalid_token for an unknown device token', async () => {
    vi.mocked(resolveDeviceAccessToken).mockResolvedValue({ status: 'invalid' });
    const res = await withAuth(vi.fn())(makeRequest('GET', 'Bearer ntsa_nope'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('invalid_token');
  });

  it('returns 401 invalid_token for malformed bearer values, never 500 (Review Focus 4)', async () => {
    vi.mocked(resolveDeviceAccessToken).mockResolvedValue({ status: 'invalid' });
    vi.mocked(resolveApiToken).mockResolvedValue(null);
    vi.mocked(auth).mockResolvedValue(null as never);
    for (const value of ['Bearer abc', 'Bearer ntsa_']) {
      const res = await withAuth(vi.fn())(makeRequest('GET', value));
      expect(res.status, value).toBe(401);
      expect((await res.json()).code, value).toBe('invalid_token');
    }
    // An empty bearer value is not extracted as a token, so it falls to the
    // cookie path (no session), which has no `code`: assert the status only.
    const empty = await withAuth(vi.fn())(makeRequest('GET', 'Bearer '));
    expect(empty.status).toBe(401);
  });

  it('marks cookie sessions and API tokens with their authMethod', async () => {
    vi.mocked(resolveApiToken).mockResolvedValue({ userId: 'u1', scope: 'READ_WRITE', tokenId: 't1' });
    const handler = vi.fn().mockResolvedValue(apiResponse.ok({ ok: true }));
    await withAuth(handler)(makeRequest('GET', 'Bearer ntag_abc'));
    expect(handler.mock.calls[0][1].authMethod).toBe('apiToken');

    vi.mocked(auth).mockResolvedValue({ user: { id: 'u2' }, expires: '' } as never);
    await withAuth(handler)(makeRequest('GET'));
    expect(handler.mock.calls[1][1].authMethod).toBe('session');
  });
});
