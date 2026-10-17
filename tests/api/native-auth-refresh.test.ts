import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ refreshDeviceSession: vi.fn(), checkRateLimit: vi.fn(), findUnique: vi.fn() }));

vi.mock('@/lib/native-auth/sessions', () => ({ refreshDeviceSession: mocks.refreshDeviceSession }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { POST } from '@/app/api/auth/native/refresh/route';

function refresh(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/native/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/auth/native/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue(null);
  });

  it('returns a new pair in the login shape', async () => {
    mocks.refreshDeviceSession.mockResolvedValue({
      status: 'ok',
      userId: 'u1',
      session: { sessionId: 's1', accessToken: 'ntsa_b', accessTokenExpiresAt: new Date('2026-10-17T12:00:00.000Z'), refreshToken: 'ntsr_b' },
    });
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Matto' });

    const res = await refresh({ refreshToken: 'ntsr_a' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      accessToken: 'ntsa_b',
      accessTokenExpiresAt: '2026-10-17T12:00:00.000Z',
      refreshToken: 'ntsr_b',
      sessionId: 's1',
      user: { id: 'u1', email: 'a@b.c', name: 'Matto' },
    });
  });

  it('returns 401 session_expired when the session cannot be refreshed', async () => {
    mocks.refreshDeviceSession.mockResolvedValue({ status: 'expired' });
    const res = await refresh({ refreshToken: 'ntsr_a' });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('session_expired');
  });

  it('returns 401 session_expired when the user no longer exists', async () => {
    mocks.refreshDeviceSession.mockResolvedValue({
      status: 'ok',
      userId: 'gone',
      session: { sessionId: 's1', accessToken: 'ntsa_b', accessTokenExpiresAt: new Date(), refreshToken: 'ntsr_b' },
    });
    mocks.findUnique.mockResolvedValue(null);
    const res = await refresh({ refreshToken: 'ntsr_a' });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed body with 400 validation_failed', async () => {
    const res = await refresh({});
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('validation_failed');
  });

  it('shares the login rate limit', async () => {
    mocks.checkRateLimit.mockReturnValue(
      new Response(JSON.stringify({ error: 'Too many' }), { status: 429, headers: { 'Retry-After': '60' } })
    );
    const res = await refresh({ refreshToken: 'ntsr_a' });
    expect(res.status).toBe(429);
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.any(Request), 'login');
  });
});
