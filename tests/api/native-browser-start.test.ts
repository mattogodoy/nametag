import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  providers: { credentials: true, google: false, oidc: { enabled: true, name: 'SSO' } },
  signIn: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/lib/server-info', () => ({ getLoginProviders: () => mocks.providers }));
vi.mock('@/lib/auth', () => ({ signIn: mocks.signIn }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/env', () => ({ env: { NEXTAUTH_SECRET: 's'.repeat(32), NEXTAUTH_URL: 'https://nametag.example' } }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { GET } from '@/app/api/auth/native/browser/start/route';
import { verifyPending, PENDING_COOKIE } from '@/lib/native-auth/browser-cookie';

const STATE = 'abcdefghijklmnop';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function start(params: Record<string, string>) {
  const url = new URL('http://0.0.0.0:3000/api/auth/native/browser/start');
  const defaults: Record<string, string> = {
    provider: 'oidc',
    state: STATE,
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    device_name: "Matto's iPhone",
    platform: 'IOS',
    app_version: '1.0.0',
  };
  for (const [k, v] of Object.entries({ ...defaults, ...params })) {
    if (v !== '') url.searchParams.set(k, v);
  }
  return GET(new Request(url));
}

describe('GET /api/auth/native/browser/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providers = { credentials: true, google: false, oidc: { enabled: true, name: 'SSO' } };
    mocks.signIn.mockResolvedValue('https://idp.example/authorize?client_id=x');
  });

  it('stores the request in a signed cookie and hands off to NextAuth', async () => {
    const res = await start({});
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://idp.example/authorize?client_id=x');
    expect(mocks.signIn).toHaveBeenCalledWith('oidc', {
      redirectTo: '/api/auth/native/browser/complete',
      redirect: false,
    });
    const [name, value, options] = mocks.set.mock.calls[0];
    expect(name).toBe(PENDING_COOKIE);
    expect(options).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 });
    expect(verifyPending(value)).toMatchObject({
      provider: 'oidc',
      state: STATE,
      codeChallenge: CHALLENGE,
      device: { name: "Matto's iPhone", platform: 'IOS', appVersion: '1.0.0' },
    });
  });

  it('redirects with sign_in_failed when NextAuth returns no provider URL', async () => {
    mocks.signIn.mockResolvedValue(undefined);
    const res = await start({});
    expect(res.headers.get('location')).toBe(`nametag://auth/callback?error=sign_in_failed&state=${STATE}`);
  });

  it('redirects to the app with provider_unavailable for a disabled provider', async () => {
    const res = await start({ provider: 'google' });
    expect(res.headers.get('location')).toBe(`nametag://auth/callback?error=provider_unavailable&state=${STATE}`);
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it.each([
    [{ code_challenge_method: 'plain' }],
    [{ code_challenge: 'short' }],
    [{ platform: 'WINDOWS' }],
    [{ device_name: '' }],
    [{ provider: 'github' }],
  ])('redirects with invalid_request for bad parameters %j', async (params) => {
    const res = await start(params);
    expect(res.headers.get('location')).toBe(`nametag://auth/callback?error=invalid_request&state=${STATE}`);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('shows the expired page when state is missing or malformed', async () => {
    for (const state of ['', 'bad']) {
      const res = await start({ state });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://nametag.example/native-auth/expired');
    }
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
});
