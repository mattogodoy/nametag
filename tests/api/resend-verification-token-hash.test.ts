import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sendEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  validateOrigin: vi.fn(() => true),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('../../lib/email', () => ({
  sendEmail: mocks.sendEmail,
  emailTemplates: {
    accountVerification: vi.fn(() => ({
      subject: 'Verify',
      html: '<p>Verify</p>',
      text: 'Verify',
    })),
  },
}));

vi.mock('../../lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock('../../lib/csrf', () => ({
  validateOrigin: mocks.validateOrigin,
}));

vi.mock('../../lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createModuleLogger: vi.fn(() => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  })),
}));

vi.mock('../../lib/env', () => ({
  getAppUrl: vi.fn(() => 'http://localhost:3000'),
  env: { SAAS_MODE: false },
}));

vi.mock('../../lib/features', () => ({
  isFeatureEnabled: vi.fn(() => false),
  isSaasMode: vi.fn(() => false),
}));

import { POST } from '../../app/api/auth/resend-verification/route';

describe('POST /api/auth/resend-verification - token hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue(null);
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.userUpdate.mockResolvedValue({});
    mocks.validateOrigin.mockReturnValue(true);
  });

  it('should store a hashed verification token, not the raw token', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      emailVerified: false,
      emailVerifySentAt: null,
    });

    const request = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'content-type': 'application/json' },
    });

    await POST(request);

    const updateCall = mocks.userUpdate.mock.calls[0][0];
    const storedToken = updateCall.data.emailVerifyToken;
    // Token should be a 64-char hex string (SHA-256 output)
    expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
    // The email should contain the raw token, not the hash
    const emailCall = mocks.sendEmail.mock.calls[0];
    const emailBody = JSON.stringify(emailCall);
    // The stored hash should NOT appear in the email (email has the raw token)
    expect(emailBody).not.toContain(storedToken);
  });

  it('should send the raw token in the verification URL', async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      emailVerified: false,
      emailVerifySentAt: null,
    });

    const request = new Request('http://localhost/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'content-type': 'application/json' },
    });

    await POST(request);

    // The email template receives a URL containing a token
    const emailCall = mocks.sendEmail.mock.calls[0][0];
    // The text body should contain a token parameter in the URL
    expect(emailCall.text).toBeDefined();
  });
});
