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
});
