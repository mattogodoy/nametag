import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Email Provider Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('SMTP precedence over Resend', () => {
    it('should use SMTP when both SMTP and Resend are configured', async () => {
      // Mock env with both providers configured
      const mockEnv = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_REQUIRE_TLS: true,
        SMTP_USER: 'test@example.com',
        SMTP_PASS: 'test-password',
        EMAIL_DOMAIN: 'test.example.com',
        RESEND_API_KEY: 'test-resend-api-key', // Also configured
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: undefined,
      };

      vi.doMock('../../lib/env', () => ({
        env: mockEnv,
        getEnv: () => mockEnv,
        getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
      }));

      const mockSmtpSendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-123' });
      const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'resend-123' }, error: null });

      vi.doMock('nodemailer', () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSmtpSendMail,
          })),
        },
      }));

      vi.doMock('resend', () => ({
        Resend: class MockResend {
          emails = {
            send: mockResendSend,
          };
          batch = {
            send: vi.fn(),
          };
        },
      }));

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Should use SMTP (not Resend)
      expect(result.success).toBe(true);
      expect(result.id).toBe('smtp-123');
      expect(mockSmtpSendMail).toHaveBeenCalled();
      expect(mockResendSend).not.toHaveBeenCalled();
    });
  });

  describe('Resend fallback', () => {
    it('should use Resend when only Resend is configured', async () => {
      // Mock env with only Resend configured
      const mockEnv = {
        RESEND_API_KEY: 'test-resend-api-key',
        EMAIL_DOMAIN: 'test.example.com',
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: undefined,
      };

      vi.doMock('../../lib/env', () => ({
        env: mockEnv,
        getEnv: () => mockEnv,
        getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
      }));

      const mockSmtpSendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-123' });
      const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'resend-123' }, error: null });

      vi.doMock('nodemailer', () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSmtpSendMail,
          })),
        },
      }));

      vi.doMock('resend', () => ({
        Resend: class MockResend {
          emails = {
            send: mockResendSend,
          };
          batch = {
            send: vi.fn(),
          };
        },
      }));

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Should use Resend (not SMTP)
      expect(result.success).toBe(true);
      expect(result.id).toBe('resend-123');
      expect(mockResendSend).toHaveBeenCalled();
      expect(mockSmtpSendMail).not.toHaveBeenCalled();
    });
  });

  describe('No provider configured', () => {
    it('should skip email gracefully when neither provider is configured', async () => {
      // Mock env with no providers configured
      const mockEnv = {
        RESEND_API_KEY: undefined,
        EMAIL_DOMAIN: undefined,
        SMTP_HOST: undefined,
        SMTP_PORT: undefined,
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: undefined,
      };

      vi.doMock('../../lib/env', () => ({
        env: mockEnv,
        getEnv: () => mockEnv,
        getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
      }));

      const mockSmtpSendMail = vi.fn();
      const mockResendSend = vi.fn();

      vi.doMock('nodemailer', () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSmtpSendMail,
          })),
        },
      }));

      vi.doMock('resend', () => ({
        Resend: class MockResend {
          emails = {
            send: mockResendSend,
          };
          batch = {
            send: vi.fn(),
          };
        },
      }));

      const { sendEmail, isEmailConfigured } = await import('../../lib/email');

      expect(isEmailConfigured()).toBe(false);

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Should skip gracefully
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toBe('Email not configured');
      expect(mockSmtpSendMail).not.toHaveBeenCalled();
      expect(mockResendSend).not.toHaveBeenCalled();
    });
  });

  describe('SMTP only configuration', () => {
    it('should use SMTP when only SMTP is configured', async () => {
      // Mock env with only SMTP configured
      const mockEnv = {
        SMTP_HOST: 'smtp.test.com',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_REQUIRE_TLS: true,
        SMTP_USER: 'test@example.com',
        SMTP_PASS: 'test-password',
        EMAIL_DOMAIN: 'test.example.com',
        RESEND_API_KEY: undefined,
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXT_PUBLIC_APP_URL: undefined,
      };

      vi.doMock('../../lib/env', () => ({
        env: mockEnv,
        getEnv: () => mockEnv,
        getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
      }));

      const mockSmtpSendMail = vi.fn().mockResolvedValue({ messageId: 'smtp-123' });
      const mockResendSend = vi.fn();

      vi.doMock('nodemailer', () => ({
        default: {
          createTransport: vi.fn(() => ({
            sendMail: mockSmtpSendMail,
          })),
        },
      }));

      vi.doMock('resend', () => ({
        Resend: class MockResend {
          emails = {
            send: mockResendSend,
          };
          batch = {
            send: vi.fn(),
          };
        },
      }));

      const { sendEmail, isEmailConfigured } = await import('../../lib/email');

      expect(isEmailConfigured()).toBe(true);

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('smtp-123');
      expect(mockSmtpSendMail).toHaveBeenCalled();
      expect(mockResendSend).not.toHaveBeenCalled();
    });
  });
});
