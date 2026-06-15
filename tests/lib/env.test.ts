import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { validateEnv } from '@/lib/env';

const BASE_VALID_ENV: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/nametag_db',
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXTAUTH_SECRET: 'a-very-long-secret-that-is-at-least-32-chars!!',
  CRON_SECRET: 'a-cron-secret-that-is-long-enough',
  NODE_ENV: 'test',
};

const SAAS_REQUIRED_ENV: Record<string, string> = {
  ...BASE_VALID_ENV,
  SAAS_MODE: 'true',
  RESEND_API_KEY: 'resend-key',
  EMAIL_DOMAIN: 'example.com',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
};

describe('env validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('STRIPE_WEBHOOK_SECRET', () => {
    it('should require STRIPE_WEBHOOK_SECRET when SAAS_MODE is true', () => {
      const envWithoutStripe = { ...SAAS_REQUIRED_ENV };
      delete envWithoutStripe['STRIPE_WEBHOOK_SECRET'];
      process.env = envWithoutStripe as NodeJS.ProcessEnv;

      expect(() => validateEnv()).toThrow(/STRIPE_WEBHOOK_SECRET/);
    });

    it('should pass when STRIPE_WEBHOOK_SECRET is set in SaaS mode', () => {
      process.env = { ...SAAS_REQUIRED_ENV } as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });

    it('should not require STRIPE_WEBHOOK_SECRET when SAAS_MODE is not enabled', () => {
      // Note: z.coerce.boolean() coerces any non-empty string to true,
      // so omitting SAAS_MODE (which defaults to false) is the correct way
      // to test non-SaaS mode.
      process.env = { ...BASE_VALID_ENV } as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('OIDC configuration', () => {
    it('should accept valid OIDC configuration', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_ISSUER_URL: 'https://auth.example.com/realms/main',
        OIDC_CLIENT_ID: 'nametag',
        OIDC_CLIENT_SECRET: 'secret',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });

    it('should accept OIDC with display name', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_ISSUER_URL: 'https://auth.example.com/realms/main',
        OIDC_CLIENT_ID: 'nametag',
        OIDC_CLIENT_SECRET: 'secret',
        OIDC_DISPLAY_NAME: 'Authentik',
      } as unknown as NodeJS.ProcessEnv;

      const result = validateEnv();
      expect(result.OIDC_DISPLAY_NAME).toBe('Authentik');
    });

    it('should default OIDC_DISPLAY_NAME to SSO', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_ISSUER_URL: 'https://auth.example.com/realms/main',
        OIDC_CLIENT_ID: 'nametag',
        OIDC_CLIENT_SECRET: 'secret',
      } as unknown as NodeJS.ProcessEnv;

      const result = validateEnv();
      expect(result.OIDC_DISPLAY_NAME).toBe('SSO');
    });

    it('should not require OIDC variables when not configured', () => {
      process.env = { ...BASE_VALID_ENV } as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });
  });

  describe('DISABLE_PASSWORD_LOGIN', () => {
    it('should accept DISABLE_PASSWORD_LOGIN when OIDC is fully configured', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_ISSUER_URL: 'https://auth.example.com/realms/main',
        OIDC_CLIENT_ID: 'nametag',
        OIDC_CLIENT_SECRET: 'secret',
        DISABLE_PASSWORD_LOGIN: 'true',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });

    it('should reject DISABLE_PASSWORD_LOGIN without OIDC_ISSUER_URL', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_CLIENT_ID: 'nametag',
        OIDC_CLIENT_SECRET: 'secret',
        DISABLE_PASSWORD_LOGIN: 'true',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).toThrow(/OIDC_ISSUER_URL/);
    });

    it('should reject DISABLE_PASSWORD_LOGIN without OIDC_CLIENT_ID', () => {
      process.env = {
        ...BASE_VALID_ENV,
        OIDC_ISSUER_URL: 'https://auth.example.com/realms/main',
        OIDC_CLIENT_SECRET: 'secret',
        DISABLE_PASSWORD_LOGIN: 'true',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).toThrow(/OIDC_CLIENT_ID/);
    });

    it('should reject DISABLE_PASSWORD_LOGIN without any OIDC config', () => {
      process.env = {
        ...BASE_VALID_ENV,
        DISABLE_PASSWORD_LOGIN: 'true',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).toThrow(/OIDC_ISSUER_URL/);
    });

    it('should not require OIDC when DISABLE_PASSWORD_LOGIN is false', () => {
      process.env = {
        ...BASE_VALID_ENV,
        DISABLE_PASSWORD_LOGIN: 'false',
      } as unknown as NodeJS.ProcessEnv;

      expect(() => validateEnv()).not.toThrow();
    });
  });
});
