import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consume: vi.fn(),
  createDeviceSession: vi.fn(),
  findUnique: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/native-auth/codes', () => ({ consumeNativeAuthCode: mocks.consume }));
vi.mock('@/lib/native-auth/sessions', () => ({ createDeviceSession: mocks.createDeviceSession }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { POST } from '@/app/api/auth/native/browser/exchange/route';

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const device = { name: 'Pixel', platform: 'ANDROID', appVersion: '1.0.0' };

function exchange(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/native/browser/exchange', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
}

describe('POST /api/auth/native/browser/exchange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue(null);
  });

  it('returns device session tokens for a valid code', async () => {
    mocks.consume.mockResolvedValue({ status: 'ok', userId: 'u1', device });
    mocks.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Matto' });
    mocks.createDeviceSession.mockResolvedValue({
      sessionId: 's1',
      accessToken: 'ntsa_a',
      accessTokenExpiresAt: new Date('2026-10-17T11:00:00.000Z'),
      refreshToken: 'ntsr_r',
    });

    const res = await exchange({ code: 'ntc_abc', codeVerifier: VERIFIER });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      accessToken: 'ntsa_a',
      accessTokenExpiresAt: '2026-10-17T11:00:00.000Z',
      refreshToken: 'ntsr_r',
      sessionId: 's1',
      user: { id: 'u1', email: 'a@b.c', name: 'Matto' },
    });
    expect(mocks.consume).toHaveBeenCalledWith('ntc_abc', VERIFIER);
    expect(mocks.createDeviceSession).toHaveBeenCalledWith('u1', device);
  });

  it.each(['unknown', 'expired', 'verifier'])('returns the same 401 for a %s code', async (reason) => {
    mocks.consume.mockResolvedValue({ status: 'invalid', reason });
    const res = await exchange({ code: 'ntc_abc', codeVerifier: VERIFIER });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid or expired sign-in code', code: 'invalid_code' });
    expect(mocks.createDeviceSession).not.toHaveBeenCalled();
  });

  it('returns invalid_code if the user no longer exists', async () => {
    mocks.consume.mockResolvedValue({ status: 'ok', userId: 'gone', device });
    mocks.findUnique.mockResolvedValue(null);
    const res = await exchange({ code: 'ntc_abc', codeVerifier: VERIFIER });
    expect((await res.json()).code).toBe('invalid_code');
  });

  it.each([[{ code: 'ntc_abc' }], [{ code: 'ntc_abc', codeVerifier: 'short' }], ['not json']])(
    'rejects a bad body with 400 validation_failed',
    async (body) => {
      const res = await exchange(body);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('validation_failed');
      expect(mocks.consume).not.toHaveBeenCalled();
    }
  );

  it('uses the nativeRefresh rate limit', async () => {
    mocks.checkRateLimit.mockReturnValue(
      new Response(JSON.stringify({ error: 'Too many' }), { status: 429, headers: { 'Retry-After': '60' } })
    );
    const res = await exchange({ code: 'ntc_abc', codeVerifier: VERIFIER });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(expect.any(Request), 'nativeRefresh');
  });
});
