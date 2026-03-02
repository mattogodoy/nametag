import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the env module with SMTP configured
const mockEnv = {
  SMTP_HOST: 'smtp.test.com',
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_REQUIRE_TLS: true,
  SMTP_USER: 'test@example.com',
  SMTP_PASS: 'test-password',
  EMAIL_DOMAIN: 'test.example.com',
  RESEND_API_KEY: undefined, // Explicitly not configured
  NEXTAUTH_URL: 'http://localhost:3000',
  NEXT_PUBLIC_APP_URL: undefined,
};

vi.mock('../../lib/env', () => ({
  env: mockEnv,
  getEnv: () => mockEnv,
  getAppUrl: () => mockEnv.NEXT_PUBLIC_APP_URL || mockEnv.NEXTAUTH_URL,
}));

// Mock nodemailer
const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({
  sendMail: mockSendMail,
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

// Mock Resend (should not be called in these tests)
vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn(),
    };
    batch = {
      send: vi.fn(),
    };
  },
}));

describe('SMTP Email Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
  });

  describe('isEmailConfigured', () => {
    it('should return true when SMTP is configured', async () => {
      const { isEmailConfigured } = await import('../../lib/email');
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe('sendEmail', () => {
    it('should send email via SMTP successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBe('smtp-message-123');
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'Nametag <hello@test.example.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: undefined,
      });
    });

    it('should send email to multiple recipients', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: ['user1@example.com', 'user2@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        })
      );
    });

    it('should use accounts from address', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Verify',
        html: '<p>Verify</p>',
        from: 'accounts',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Nametag Accounts <accounts@test.example.com>',
        })
      );
    });

    it('should use reminders from address', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Reminder',
        html: '<p>Reminder</p>',
        from: 'reminders',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Nametag Reminders <reminders@test.example.com>',
        })
      );
    });

    it('should include text version when provided', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });

      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test HTML</p>',
        text: 'Test Plain Text',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test Plain Text',
        })
      );
    });

    it('should handle SMTP errors', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    it('should handle authentication errors', async () => {
      mockSendMail.mockRejectedValue(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'));

      const { sendEmail } = await import('../../lib/email');

      const result = await sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Username and Password not accepted');
    });
  });

  describe('SMTP transporter configuration', () => {
    it('should create transporter with correct configuration', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });
      mockCreateTransport.mockClear();

      // Force re-import to ensure fresh provider initialization
      vi.resetModules();
      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'test-password',
        },
        requireTLS: true,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5,
      });
    });

    it('should reuse transporter for multiple emails (connection pooling)', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'smtp-message-123' });
      mockCreateTransport.mockClear();

      // Force re-import to ensure fresh provider initialization
      vi.resetModules();
      const { sendEmail } = await import('../../lib/email');

      await sendEmail({
        to: 'test1@example.com',
        subject: 'Test 1',
        html: '<p>Test 1</p>',
      });

      await sendEmail({
        to: 'test2@example.com',
        subject: 'Test 2',
        html: '<p>Test 2</p>',
      });

      // Should only create transporter once (connection pooling)
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
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
