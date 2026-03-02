import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the env module before importing email
// Test with Resend configured (SMTP not configured)
const mockEnv = {
  RESEND_API_KEY: 'test-resend-api-key',
  EMAIL_DOMAIN: 'test.example.com',
  SMTP_HOST: undefined,
  SMTP_PORT: undefined,
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: undefined,
};

vi.mock('../../lib/env', () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
  getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
}));

// Mock Resend properly as a class
const mockSend = vi.fn();
const mockBatchSend = vi.fn();
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = {
        send: mockSend,
      };
      batch = {
        send: mockBatchSend,
      };
    },
  };
});

// Mock nodemailer (not used in this test but needs to be mocked)
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

describe('email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('email-123');
      expect(mockSend).toHaveBeenCalledWith({
        from: 'Nametag <hello@test.example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: undefined,
      });
    });

    it('should send email to multiple recipients', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        })
      );
    });

    it('should use accounts from address', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Verify',
        html: '<p>Verify</p>',
        from: 'accounts',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Nametag Accounts <accounts@test.example.com>',
        })
      );
    });

    it('should use reminders from address', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        from: 'reminders',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Nametag Reminders <reminders@test.example.com>',
        })
      );
    });

    it('should include text version when provided', async () => {
      mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test HTML</p>',
        text: 'Test Plain Text',
      });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test Plain Text',
        })
      );
    });

    it('should handle Resend API error', async () => {
      mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle network errors', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send email');
    });
  });

  describe('isEmailConfigured', () => {
    it('should return true when email is configured', async () => {
      const { isEmailConfigured } = await import('../../lib/email');
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe('emailTemplates', () => {
    describe('accountVerification', () => {
      it('should generate verification email', async () => {
        const { emailTemplates } = await import('../../lib/email');

        const template = await emailTemplates.accountVerification('https://example.com/verify?token=abc');

        expect(template.subject).toBe('Verify your Nametag account');
        expect(template.html).toContain('Welcome to Nametag');
        expect(template.html).toContain('https://example.com/verify?token=abc');
        expect(template.text).toContain('https://example.com/verify?token=abc');
      });
    });

    describe('importantDateReminder', () => {
      it('should generate reminder email', async () => {
        const { emailTemplates } = await import('../../lib/email');

        const template = await emailTemplates.importantDateReminder('John Doe', 'Birthday', 'March 15', 'https://example.com/unsubscribe');

        expect(template.subject).toContain('John Doe');
        expect(template.subject).toContain('Birthday');
        expect(template.html).toContain('John Doe');
        expect(template.html).toContain('Birthday');
        expect(template.html).toContain('March 15');
        expect(template.text).toContain('John Doe');
      });
    });

    describe('contactReminder', () => {
      it('should generate contact reminder with last contact date', async () => {
        const { emailTemplates } = await import('../../lib/email');

        const template = await emailTemplates.contactReminder('Jane Smith', 'January 1, 2024', '2 weeks', 'https://example.com/unsubscribe');

        expect(template.subject).toContain('Jane Smith');
        expect(template.html).toContain('Jane Smith');
        expect(template.html).toContain('January 1, 2024');
        expect(template.html).toContain('2 weeks');
        expect(template.text).toContain('Jane Smith');
      });

      it('should handle null last contact date', async () => {
        const { emailTemplates } = await import('../../lib/email');

        const template = await emailTemplates.contactReminder('Jane Smith', null, '1 month', 'https://example.com/unsubscribe');

        expect(template.html).toContain('Jane Smith');
        expect(template.html).not.toContain('last contact:');
        expect(template.text).toContain('Jane Smith');
      });
    });

    describe('passwordReset', () => {
      it('should generate password reset email', async () => {
        const { emailTemplates } = await import('../../lib/email');

        const template = await emailTemplates.passwordReset('https://example.com/reset?token=xyz');

        expect(template.subject).toBe('Reset your Nametag password');
        expect(template.html).toContain('Password Reset');
        expect(template.html).toContain('https://example.com/reset?token=xyz');
        expect(template.html).toContain('1 hour');
        expect(template.text).toContain('https://example.com/reset?token=xyz');
      });
    });
  });

  describe('fromAddresses', () => {
    it('should have correct from addresses', async () => {
      const { fromAddresses } = await import('../../lib/email');

      expect(fromAddresses.accounts).toBe('Nametag Accounts <accounts@test.example.com>');
      expect(fromAddresses.reminders).toBe('Nametag Reminders <reminders@test.example.com>');
      expect(fromAddresses.default).toBe('Nametag <hello@test.example.com>');
    });
  });
});
