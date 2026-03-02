import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the env module
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

// Mock Resend
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

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

describe('Resend retry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should succeed on first attempt without retrying', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('email-1');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should retry on rate_limit_exceeded and succeed on 2nd attempt', async () => {
    mockSend
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded', name: 'rate_limit_exceeded', statusCode: 429 },
      })
      .mockResolvedValueOnce({ data: { id: 'email-2' }, error: null });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('email-2');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should exhaust all 3 retries on persistent rate limit error', async () => {
    const rateLimitError = {
      data: null,
      error: { message: 'Rate limit exceeded', name: 'rate_limit_exceeded', statusCode: 429 },
    };
    mockSend
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(rateLimitError)
      .mockResolvedValueOnce(rateLimitError);

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit exceeded');
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should retry on thrown network error and succeed', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ data: { id: 'email-3' }, error: null });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe('email-3');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should NOT retry on non-retryable error (invalid_api_key)', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key', name: 'invalid_api_key', statusCode: 401 },
    });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on non-retryable thrown error', async () => {
    mockSend.mockRejectedValue(new Error('Invalid request body'));

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to send email');
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should retry on internal_server_error', async () => {
    mockSend
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Internal server error', name: 'internal_server_error', statusCode: 500 },
      })
      .mockResolvedValueOnce({ data: { id: 'email-4' }, error: null });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should retry on timeout errors', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ data: { id: 'email-5' }, error: null });

    const { sendEmail } = await import('../../lib/email');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
