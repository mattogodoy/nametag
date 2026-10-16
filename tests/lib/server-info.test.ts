import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saas: false,
  flags: { oidc: false, passwordLogin: true } as Record<string, boolean>,
  env: {} as Record<string, string | undefined>,
  push: false,
  userCount: vi.fn(),
}));

vi.mock('@/lib/features', () => ({
  isSaasMode: () => mocks.saas,
  isFeatureEnabled: (f: string) => {
    if (f in mocks.flags) return mocks.flags[f];
    if (f === 'billing' || f === 'emailVerification') return mocks.saas;
    if (f === 'cardDav') return true;
    return false;
  },
}));
vi.mock('@/lib/env', () => ({ env: new Proxy({}, { get: (_t, k: string) => mocks.env[k] }) }));
vi.mock('@/lib/notifications/vapid', () => ({ isPushConfigured: () => mocks.push }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { count: mocks.userCount } } }));

import { getLoginProviders, getRegistrationStatus, getServerInfo, API_VERSION } from '@/lib/server-info';
import packageJson from '@/package.json';

describe('server-info helpers', () => {
  beforeEach(() => {
    mocks.saas = false;
    mocks.flags = { oidc: false, passwordLogin: true };
    mocks.env = {};
    mocks.push = false;
    mocks.userCount.mockReset();
    vi.unstubAllEnvs();
  });

  describe('getLoginProviders', () => {
    it('reports google only in SaaS mode with both Google credentials set', () => {
      mocks.saas = true;
      mocks.env = { GOOGLE_CLIENT_ID: 'id' };
      expect(getLoginProviders().google).toBe(false);
      mocks.env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
      expect(getLoginProviders().google).toBe(true);
      mocks.saas = false;
      expect(getLoginProviders().google).toBe(false);
    });

    it('falls back to "SSO" when no OIDC display name is set', () => {
      mocks.flags.oidc = true;
      expect(getLoginProviders().oidc).toEqual({ enabled: true, name: 'SSO' });
      mocks.env = { OIDC_DISPLAY_NAME: 'Authentik' };
      expect(getLoginProviders().oidc.name).toBe('Authentik');
    });
  });

  describe('getRegistrationStatus', () => {
    it('is disabled with passwordLoginDisabled when password login is off', async () => {
      mocks.flags.passwordLogin = false;
      expect(await getRegistrationStatus()).toEqual({ enabled: false, reason: 'passwordLoginDisabled' });
      expect(mocks.userCount).not.toHaveBeenCalled();
    });

    it('is enabled when DISABLE_REGISTRATION is not true', async () => {
      expect(await getRegistrationStatus()).toEqual({ enabled: true });
    });

    it('lets the first user register even when registration is disabled', async () => {
      vi.stubEnv('DISABLE_REGISTRATION', 'true');
      mocks.userCount.mockResolvedValue(0);
      expect(await getRegistrationStatus()).toEqual({ enabled: true });
    });

    it('is disabled once a user exists and registration is disabled', async () => {
      vi.stubEnv('DISABLE_REGISTRATION', 'true');
      mocks.userCount.mockResolvedValue(3);
      expect(await getRegistrationStatus()).toEqual({ enabled: false, reason: 'registrationDisabled' });
    });
  });

  describe('getServerInfo', () => {
    it('describes a self-hosted server', async () => {
      mocks.flags.oidc = true;
      mocks.push = true;
      mocks.env = { OIDC_DISPLAY_NAME: 'Authentik' };
      expect(await getServerInfo()).toEqual({
        name: 'Nametag',
        version: packageJson.version,
        apiVersion: API_VERSION,
        mode: 'selfhosted',
        auth: {
          password: true,
          google: false,
          oidc: { enabled: true, name: 'Authentik' },
          emailVerificationRequired: false,
          registration: { enabled: true },
        },
        features: { billing: false, cardDav: true, webPush: true },
      });
    });

    it('describes a SaaS server', async () => {
      mocks.saas = true;
      mocks.env = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' };
      const info = await getServerInfo();
      expect(info.mode).toBe('saas');
      expect(info.auth.google).toBe(true);
      expect(info.auth.emailVerificationRequired).toBe(true);
      expect(info.features.billing).toBe(true);
    });

    it('never includes configured secrets', async () => {
      mocks.saas = true;
      mocks.flags.oidc = true;
      mocks.env = {
        GOOGLE_CLIENT_ID: 'google-id-SECRET1',
        GOOGLE_CLIENT_SECRET: 'google-secret-SECRET2',
        OIDC_ISSUER_URL: 'https://idp.internal-SECRET3',
        OIDC_CLIENT_ID: 'oidc-id-SECRET4',
        OIDC_CLIENT_SECRET: 'oidc-secret-SECRET5',
      };
      const body = JSON.stringify(await getServerInfo());
      expect(body).not.toMatch(/SECRET\d/);
    });
  });
});
