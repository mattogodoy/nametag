import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: new Map<string, string>(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.store.has(name) ? { name, value: mocks.store.get(name) } : undefined),
  }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/components/LoginForm', () => ({ default: () => null }));
vi.mock('@/lib/env', () => ({
  env: { NEXTAUTH_SECRET: 's'.repeat(32), NEXTAUTH_URL: 'https://nametag.example' },
}));

import LoginPage from '@/app/login/page';
import { signPending, PENDING_COOKIE } from '@/lib/native-auth/browser-cookie';

const pendingValue = () =>
  signPending({
    provider: 'oidc',
    state: 'abcdefghijklmnop',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    device: { name: 'Pixel', platform: 'ANDROID', appVersion: '1.0.0' },
    exp: Date.now() + 60_000,
  });

describe('/login with a pending native sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.clear();
  });

  it('forwards a provider error to the native completion step', async () => {
    mocks.store.set(PENDING_COOKIE, pendingValue());
    await expect(LoginPage({ searchParams: Promise.resolve({ error: 'AccessDenied' }) })).rejects.toThrow(
      'NEXT_REDIRECT /api/auth/native/browser/complete'
    );
  });

  it('renders the normal form for a web user with an error and no pending sign-in', async () => {
    const result = await LoginPage({ searchParams: Promise.resolve({ error: 'AccessDenied' }) });
    expect(result.props.initialError).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('renders the normal form when a pending sign-in exists but there is no error', async () => {
    mocks.store.set(PENDING_COOKIE, pendingValue());
    const result = await LoginPage({ searchParams: Promise.resolve({}) });
    expect(result.props.initialError).toBe(false);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('ignores a forged pending cookie', async () => {
    mocks.store.set(PENDING_COOKIE, 'forged.value');
    await LoginPage({ searchParams: Promise.resolve({ error: 'AccessDenied' }) });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
