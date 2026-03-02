import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn(),
    })),
  },
}));

function makeEmailItem(index: number) {
  return {
    to: `user${index}@example.com`,
    subject: `Subject ${index}`,
    html: `<p>Body ${index}</p>`,
    from: 'reminders' as const,
  };
}

describe('Email batch sending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should send batch of N<=100 emails in a single API call', async () => {
    const items = Array.from({ length: 5 }, (_, i) => makeEmailItem(i));

    mockBatchSend.mockResolvedValue({
      data: { data: items.map((_, i) => ({ id: `batch-${i}` })) },
      error: null,
    });

    const { sendEmailBatch } = await import('../../lib/email');
    const result = await sendEmailBatch(items);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(5);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].id).toBe('batch-0');
    expect(mockBatchSend).toHaveBeenCalledTimes(1);

    // Verify the payload was sent with correct from address
    const payload = mockBatchSend.mock.calls[0][0];
    expect(payload).toHaveLength(5);
    expect(payload[0].from).toBe('Nametag Reminders <reminders@test.example.com>');
  });

  it('should split batch of 150 emails into 2 API calls', async () => {
    const items = Array.from({ length: 150 }, (_, i) => makeEmailItem(i));

    mockBatchSend
      .mockResolvedValueOnce({
        data: { data: Array.from({ length: 100 }, (_, i) => ({ id: `batch-a-${i}` })) },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { data: Array.from({ length: 50 }, (_, i) => ({ id: `batch-b-${i}` })) },
        error: null,
      });

    const { sendEmailBatch } = await import('../../lib/email');
    const result = await sendEmailBatch(items);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(150);
    expect(mockBatchSend).toHaveBeenCalledTimes(2);

    // First chunk: 100, second chunk: 50
    expect(mockBatchSend.mock.calls[0][0]).toHaveLength(100);
    expect(mockBatchSend.mock.calls[1][0]).toHaveLength(50);
  });

  it('should handle permissive mode with some failures', async () => {
    const items = Array.from({ length: 3 }, (_, i) => makeEmailItem(i));

    // Index 1 fails in permissive mode
    mockBatchSend.mockResolvedValue({
      data: { data: [{ id: 'batch-0' }, { id: 'batch-2' }] },
      error: null,
      errors: [{ index: 1, message: 'Invalid email address' }],
    });

    const { sendEmailBatch } = await import('../../lib/email');
    const result = await sendEmailBatch(items);

    expect(result.success).toBe(false); // At least one failure
    expect(result.results).toHaveLength(3);
    expect(result.results[0]).toEqual({ success: true, id: 'batch-0' });
    expect(result.results[1]).toEqual({ success: false, error: 'Invalid email address' });
    expect(result.results[2]).toEqual({ success: true, id: 'batch-2' });
  });

  it('should mark all items as failed when batch API returns error after retries', async () => {
    const items = Array.from({ length: 3 }, (_, i) => makeEmailItem(i));

    // Non-retryable error
    mockBatchSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key', name: 'invalid_api_key', statusCode: 401 },
    });

    const { sendEmailBatch } = await import('../../lib/email');
    const result = await sendEmailBatch(items);

    expect(result.success).toBe(false);
    expect(result.results).toHaveLength(3);
    for (const r of result.results) {
      expect(r.success).toBe(false);
      expect(r.error).toBe('Invalid API key');
    }
  });

  it('should return skipped results when provider is not configured', async () => {
    // Override env to not have Resend configured
    mockEnv.RESEND_API_KEY = undefined as unknown as string;

    const { sendEmailBatch } = await import('../../lib/email');
    const items = Array.from({ length: 2 }, (_, i) => makeEmailItem(i));

    const result = await sendEmailBatch(items);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    for (const r of result.results) {
      expect(r.skipped).toBe(true);
    }

    // Restore
    mockEnv.RESEND_API_KEY = 'test-resend-api-key';
  });

  it('should retry batch API call on rate limit error', async () => {
    const items = Array.from({ length: 2 }, (_, i) => makeEmailItem(i));

    mockBatchSend
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded', name: 'rate_limit_exceeded', statusCode: 429 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 'batch-0' }, { id: 'batch-1' }] },
        error: null,
      });

    const { sendEmailBatch } = await import('../../lib/email');
    const result = await sendEmailBatch(items);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(mockBatchSend).toHaveBeenCalledTimes(2);
  });
});

describe('SMTP batch fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should send sequentially via SMTP when Resend is not configured', async () => {
    const smtpMockEnv = {
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

    const mockSmtpSend = vi.fn().mockResolvedValue({ messageId: 'smtp-123' });

    vi.doMock('../../lib/env', () => ({
      env: smtpMockEnv,
      getEnv: () => smtpMockEnv,
      getAppUrl: () => smtpMockEnv.NEXT_PUBLIC_APP_URL || smtpMockEnv.NEXTAUTH_URL,
    }));

    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({
          sendMail: mockSmtpSend,
        })),
      },
    }));

    vi.doMock('resend', () => ({
      Resend: class MockResend {
        emails = { send: vi.fn() };
        batch = { send: vi.fn() };
      },
    }));

    const { sendEmailBatch } = await import('../../lib/email');
    const items = Array.from({ length: 3 }, (_, i) => makeEmailItem(i));

    const result = await sendEmailBatch(items);

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    // SMTP sendBatch calls send() for each message
    expect(mockSmtpSend).toHaveBeenCalledTimes(3);
  });
});
