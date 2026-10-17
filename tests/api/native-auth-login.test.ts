import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeCredentials: vi.fn(),
  createDeviceSession: vi.fn(),
  checkRateLimit: vi.fn(),
  passwordLogin: true,
}));

vi.mock('@/lib/auth', () => ({ authorizeCredentials: mocks.authorizeCredentials }));
vi.mock('@/lib/native-auth/sessions', () => ({ createDeviceSession: mocks.createDeviceSession }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock('@/lib/features', () => ({
  isFeatureEnabled: (f: string) => (f === 'passwordLogin' ? mocks.passwordLogin : false),
  isSaasMode: () => false,
}));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { POST } from '@/app/api/auth/native/login/route';

const device = { name: "Matto's iPhone", platform: 'IOS', appVersion: '1.0.0' };
const issued = {
  sessionId: 's1',
  accessToken: 'ntsa_a',
  accessTokenExpiresAt: new Date('2026-10-17T11:00:00.000Z'),
  refreshToken: 'ntsr_r',
};

function login(body: unknown) {
  return POST(
    new Request('http://localhost/api/auth/native/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

describe('POST /api/auth/native/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passwordLogin = true;
    mocks.checkRateLimit.mockReturnValue(null);
    mocks.createDeviceSession.mockResolvedValue(issued);
  });

  it('signs in and returns tokens, session id and user', async () => {
    mocks.authorizeCredentials.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Matto', surname: null, nickname: null, photo: null });

    const res = await login({ email: 'a@b.c', password: 'pw', device });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      accessToken: 'ntsa_a',
      accessTokenExpiresAt: '2026-10-17T11:00:00.000Z',
      refreshToken: 'ntsr_r',
      sessionId: 's1',
      user: { id: 'u1', email: 'a@b.c', name: 'Matto' },
    });
    expect(mocks.createDeviceSession).toHaveBeenCalledWith('u1', device);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('passes the email through to authorizeCredentials unchanged so lookup stays case-insensitive (Review Focus 5)', async () => {
    mocks.authorizeCredentials.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'M', surname: null, nickname: null, photo: null });
    await login({ email: 'A@B.C', password: 'pw', device });
    expect(mocks.authorizeCredentials).toHaveBeenCalledWith({ email: 'A@B.C', password: 'pw' });
  });

  it('returns the same 401 for a wrong password, unknown email or OAuth-only account (Review Focus 5)', async () => {
    mocks.authorizeCredentials.mockResolvedValue(null);
    const res = await login({ email: 'a@b.c', password: 'bad', device });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Invalid email or password', code: 'invalid_credentials' });
    expect(mocks.createDeviceSession).not.toHaveBeenCalled();
  });

  it.each([
    ['ACCOUNT_LOCKED', 'account_locked'],
    ['EMAIL_NOT_VERIFIED', 'email_not_verified'],
  ])('maps %s to 403 %s', async (thrown, code) => {
    mocks.authorizeCredentials.mockRejectedValue(new Error(thrown));
    const res = await login({ email: 'a@b.c', password: 'pw', device });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe(code);
  });

  it('refuses when password login is disabled', async () => {
    mocks.passwordLogin = false;
    const res = await login({ email: 'a@b.c', password: 'pw', device });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('password_login_disabled');
    expect(mocks.authorizeCredentials).not.toHaveBeenCalled();
  });

  it('passes the login rate limit through with a code and Retry-After', async () => {
    mocks.checkRateLimit.mockReturnValue(
      new Response(JSON.stringify({ error: 'Too many attempts. Please try again in 15 minutes.' }), {
        status: 429,
        headers: { 'Retry-After': '900', 'content-type': 'application/json' },
      })
    );
    const res = await login({ email: 'a@b.c', password: 'pw', device });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('900');
    expect((await res.json()).code).toBe('rate_limited');
    expect(mocks.authorizeCredentials).not.toHaveBeenCalled();
  });

  it.each([
    [{ email: 'a@b.c', password: 'pw' }],
    [{ email: 'a@b.c', password: 'pw', device: { ...device, platform: 'WINDOWS' } }],
    [{ email: 'a@b.c', password: 'pw', device: { ...device, name: 'x'.repeat(101) } }],
    [{ email: 'a@b.c', password: 'pw', device: { ...device, appVersion: '1'.repeat(33) } }],
  ])('rejects an invalid body with 400 validation_failed', async (body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('validation_failed');
  });

  it('accepts ANDROID devices', async () => {
    mocks.authorizeCredentials.mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'M', surname: null, nickname: null, photo: null });
    const res = await login({ email: 'a@b.c', password: 'pw', device: { ...device, platform: 'ANDROID' } });
    expect(res.status).toBe(200);
  });
});
