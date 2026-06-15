import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getEnv: vi.fn(),
}));

vi.mock('../../lib/env', () => ({
  env: new Proxy({}, {
    get(_, prop: string) {
      return mocks.getEnv(prop);
    },
  }),
}));

import { features, isFeatureEnabled } from '../../lib/features';

describe('features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEnv.mockReturnValue(undefined);
  });

  describe('oidc', () => {
    it('should return true when all OIDC vars are set and not in SaaS mode', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        const vals: Record<string, unknown> = {
          SAAS_MODE: false,
          OIDC_ISSUER_URL: 'https://auth.example.com',
          OIDC_CLIENT_ID: 'nametag',
          OIDC_CLIENT_SECRET: 'secret',
        };
        return vals[key];
      });

      expect(features.oidc()).toBe(true);
      expect(isFeatureEnabled('oidc')).toBe(true);
    });

    it('should return false when OIDC_ISSUER_URL is missing', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        const vals: Record<string, unknown> = {
          SAAS_MODE: false,
          OIDC_CLIENT_ID: 'nametag',
          OIDC_CLIENT_SECRET: 'secret',
        };
        return vals[key];
      });

      expect(features.oidc()).toBe(false);
    });

    it('should return false when in SaaS mode', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        const vals: Record<string, unknown> = {
          SAAS_MODE: true,
          OIDC_ISSUER_URL: 'https://auth.example.com',
          OIDC_CLIENT_ID: 'nametag',
          OIDC_CLIENT_SECRET: 'secret',
        };
        return vals[key];
      });

      expect(features.oidc()).toBe(false);
    });

    it('should return false when no OIDC vars are set', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        if (key === 'SAAS_MODE') return false;
        return undefined;
      });

      expect(features.oidc()).toBe(false);
    });
  });

  describe('passwordLogin', () => {
    it('should return true by default', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        if (key === 'DISABLE_PASSWORD_LOGIN') return false;
        if (key === 'SAAS_MODE') return false;
        return undefined;
      });

      expect(features.passwordLogin()).toBe(true);
    });

    it('should return false when DISABLE_PASSWORD_LOGIN is true and OIDC is configured', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        const vals: Record<string, unknown> = {
          SAAS_MODE: false,
          DISABLE_PASSWORD_LOGIN: true,
          OIDC_ISSUER_URL: 'https://auth.example.com',
          OIDC_CLIENT_ID: 'nametag',
          OIDC_CLIENT_SECRET: 'secret',
        };
        return vals[key];
      });

      expect(features.passwordLogin()).toBe(false);
    });

    it('should return true when DISABLE_PASSWORD_LOGIN is true but OIDC is not configured', () => {
      mocks.getEnv.mockImplementation((key: string) => {
        const vals: Record<string, unknown> = {
          SAAS_MODE: false,
          DISABLE_PASSWORD_LOGIN: true,
        };
        return vals[key];
      });

      expect(features.passwordLogin()).toBe(true);
    });
  });
});
