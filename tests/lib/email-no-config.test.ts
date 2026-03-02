import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the env module with missing email configuration
const mockEnv = {
  RESEND_API_KEY: undefined,
  EMAIL_DOMAIN: undefined,
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: undefined,
};

vi.mock('../../lib/env', () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
  getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
}));

// Mock Resend - it should never be called when config is missing
const mockSend = vi.fn();
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
      batch = {
        send: vi.fn(),
      };
    },
  };
});

describe('email without configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
  });

  describe('isEmailConfigured', () => {
    it('should return false when email is not configured', async () => {
      const { isEmailConfigured } = await import('../../lib/email');
      expect(isEmailConfigured()).toBe(false);
    });
  });

  describe('sendEmail', () => {
    it('should gracefully skip sending when email is not configured', async () => {
      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      // Should return success but with skipped flag
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('skipped', true);
      expect(result).toHaveProperty('message', 'Email not configured');

      // Resend should never be called
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should skip sending for all email types', async () => {
      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        from: 'accounts',
      });

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('skipped', true);
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('fromAddresses', () => {
    it('should return fallback addresses when EMAIL_DOMAIN is not set', async () => {
      const { fromAddresses } = await import('../../lib/email');

      expect(fromAddresses.accounts).toBe('noreply@example.com');
      expect(fromAddresses.reminders).toBe('noreply@example.com');
      expect(fromAddresses.default).toBe('noreply@example.com');
    });
  });
});
