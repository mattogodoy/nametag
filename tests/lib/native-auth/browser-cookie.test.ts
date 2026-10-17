import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: { NEXTAUTH_SECRET: 's'.repeat(32), NEXTAUTH_URL: 'https://nametag.example' },
  store: new Map<string, string>(),
  set: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: mocks.env }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    has: (name: string) => mocks.store.has(name),
    set: mocks.set,
  }),
}));

import {
  signPending,
  verifyPending,
  pendingCookieOptions,
  appRedirect,
  parseReason,
  recordNativeAuthFailure,
  PENDING_COOKIE,
  REASON_COOKIE,
  type PendingNativeAuth,
} from '@/lib/native-auth/browser-cookie';

const pending = (exp: number): PendingNativeAuth => ({
  provider: 'oidc',
  state: 'abcdefghijklmnop',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  device: { name: "Matto's iPhone", platform: 'IOS', appVersion: '1.0.0' },
  exp,
});

describe('pending cookie', () => {
  beforeEach(() => {
    mocks.env.NEXTAUTH_SECRET = 's'.repeat(32);
    mocks.env.NEXTAUTH_URL = 'https://nametag.example';
    mocks.store.clear();
    mocks.set.mockReset();
  });

  it('round-trips a valid cookie', () => {
    const p = pending(Date.now() + 60_000);
    expect(verifyPending(signPending(p))).toEqual(p);
  });

  it('rejects a tampered payload', () => {
    const [payload, sig] = signPending(pending(Date.now() + 60_000)).split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), state: 'attackerstate1234' })
    ).toString('base64url');
    expect(verifyPending(`${forged}.${sig}`)).toBeNull();
  });

  it('rejects a tampered signature, a missing value and garbage', () => {
    const value = signPending(pending(Date.now() + 60_000));
    expect(verifyPending(`${value.slice(0, -2)}xx`)).toBeNull();
    expect(verifyPending(undefined)).toBeNull();
    expect(verifyPending('not-a-cookie')).toBeNull();
    expect(verifyPending('a.b.c')).toBeNull();
  });

  it('rejects an expired cookie', () => {
    const now = Date.now();
    const value = signPending(pending(now + 1000));
    expect(verifyPending(value, now + 999)).not.toBeNull();
    expect(verifyPending(value, now + 1000)).toBeNull();
  });

  it('rejects a cookie signed with another secret', () => {
    const value = signPending(pending(Date.now() + 60_000));
    mocks.env.NEXTAUTH_SECRET = 'o'.repeat(32);
    expect(verifyPending(value)).toBeNull();
  });

  it('marks the cookie Secure only when NEXTAUTH_URL is https (Review Focus 2)', () => {
    expect(pendingCookieOptions(600)).toEqual({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 600 });
    mocks.env.NEXTAUTH_URL = 'http://192.168.1.10:3000';
    expect(pendingCookieOptions(600).secure).toBe(false);
  });
});

describe('appRedirect', () => {
  it('always targets the fixed app address', async () => {
    const res = appRedirect({ code: 'ntc_abc', state: 'abcdefghijklmnop' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('nametag://auth/callback?code=ntc_abc&state=abcdefghijklmnop');
  });

  it('encodes values instead of letting them change the target', () => {
    const res = appRedirect({ error: 'sign_in_failed', state: 'a&b=c#https://evil.example' });
    const location = res.headers.get('location') ?? '';
    expect(location.startsWith('nametag://auth/callback?')).toBe(true);
    expect(new URL(location).searchParams.get('state')).toBe('a&b=c#https://evil.example');
  });
});

describe('failure reasons', () => {
  it('accepts only known reasons', () => {
    expect(parseReason('email_not_verified')).toBe('email_not_verified');
    expect(parseReason('account_linked_elsewhere')).toBe('account_linked_elsewhere');
    expect(parseReason('something_else')).toBeNull();
    expect(parseReason(undefined)).toBeNull();
  });

  it('records a reason only while an app sign-in is pending', async () => {
    await recordNativeAuthFailure('email_not_verified');
    expect(mocks.set).not.toHaveBeenCalled();

    mocks.store.set(PENDING_COOKIE, 'x');
    await recordNativeAuthFailure('email_not_verified');
    expect(mocks.set).toHaveBeenCalledWith(
      REASON_COOKIE,
      'email_not_verified',
      expect.objectContaining({ httpOnly: true, maxAge: 60 })
    );
  });
});
