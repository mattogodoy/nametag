import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sendEmail: vi.fn(),
  auth: vi.fn(),
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

vi.mock('../../lib/auth', () => ({
  auth: mocks.auth,
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
}));

import { PUT } from '../../app/api/user/profile/route';

describe('PUT /api/user/profile - email change token hashing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue({ success: true });
    mocks.userUpdate.mockResolvedValue({});
    mocks.validateOrigin.mockReturnValue(true);
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1', email: 'old@example.com', name: 'Test' },
    });
  });

  it('should store a hashed verification token when email changes', async () => {
    // First call: check if new email is taken (findUnique with email)
    // Second call: get current user email
    mocks.userFindUnique
      .mockResolvedValueOnce(null) // new email not taken
      .mockResolvedValueOnce({ email: 'old@example.com' }); // current user email

    const request = new Request('http://localhost/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'new@example.com',
        name: 'Test',
      }),
      headers: { 'content-type': 'application/json' },
    });

    await PUT(request);

    const updateCall = mocks.userUpdate.mock.calls[0][0];
    const storedToken = updateCall.data.emailVerifyToken;
    // Token should be a 64-char hex string (SHA-256 output)
    expect(storedToken).toMatch(/^[a-f0-9]{64}$/);
    // The email should contain the raw token, not the hash
    const emailCall = mocks.sendEmail.mock.calls[0];
    const emailBody = JSON.stringify(emailCall);
    // The stored hash should NOT appear in the email
    expect(emailBody).not.toContain(storedToken);
  });

  it('should set emailVerified to false when email changes', async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: 'old@example.com' });

    const request = new Request('http://localhost/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'new@example.com',
        name: 'Test',
      }),
      headers: { 'content-type': 'application/json' },
    });

    await PUT(request);

    const updateCall = mocks.userUpdate.mock.calls[0][0];
    expect(updateCall.data.emailVerified).toBe(false);
    expect(updateCall.data.emailVerifyExpires).toBeInstanceOf(Date);
  });

  it('should not generate a verification token when email does not change', async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ email: 'old@example.com' });

    const request = new Request('http://localhost/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({
        email: 'old@example.com',
        name: 'Updated Name',
      }),
      headers: { 'content-type': 'application/json' },
    });

    await PUT(request);

    // No email should be sent
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    // Update should not contain verification token fields
    const updateCall = mocks.userUpdate.mock.calls[0][0];
    expect(updateCall.data.emailVerifyToken).toBeUndefined();
  });
});
