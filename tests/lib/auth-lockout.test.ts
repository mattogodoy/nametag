import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  bcryptCompare: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
  normalizeEmail: vi.fn((email: string) => email.toLowerCase()),
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock('bcryptjs', () => ({
  compare: mocks.bcryptCompare,
  default: { compare: mocks.bcryptCompare },
}));

vi.mock('@/lib/features', () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
  isSaasMode: vi.fn(() => false),
}));

vi.mock('@/lib/api-utils', () => ({
  normalizeEmail: mocks.normalizeEmail,
}));

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/locale', () => ({
  normalizeLocale: vi.fn((locale: string) => locale),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: mocks.sendEmail,
}));

import { authorizeCredentials, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS } from '@/lib/auth';

const baseUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: 'hashed-password',
  name: 'Test',
  surname: null,
  nickname: null,
  photo: null,
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  language: 'en',
};

describe('authorizeCredentials - account lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({});
  });

  it('rejects a locked account without checking password', async () => {
    const lockedUser = {
      ...baseUser,
      failedLoginAttempts: 10,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // locked for 15 more minutes
    };
    mocks.findUnique.mockResolvedValue(lockedUser);

    await expect(
      authorizeCredentials({ email: 'test@example.com', password: 'anything' })
    ).rejects.toThrow('ACCOUNT_LOCKED');
    // bcrypt.compare should NOT have been called
    expect(mocks.bcryptCompare).not.toHaveBeenCalled();
    // No database update should occur
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('increments failedLoginAttempts on wrong password', async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 3 });
    mocks.bcryptCompare.mockResolvedValue(false);

    const result = await authorizeCredentials({ email: 'test@example.com', password: 'wrong' });

    expect(result).toBeNull();
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  });

  it('sets lockedUntil on the 10th failed attempt', async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 9 });
    mocks.bcryptCompare.mockResolvedValue(false);

    const before = Date.now();
    const result = await authorizeCredentials({ email: 'test@example.com', password: 'wrong' });
    const after = Date.now();

    expect(result).toBeNull();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    const updateCall = mocks.update.mock.calls[0][0];
    expect(updateCall.data.failedLoginAttempts).toEqual({ increment: 1 });
    expect(updateCall.data.lockedUntil).toBeDefined();

    const lockTime = updateCall.data.lockedUntil.getTime();
    expect(lockTime).toBeGreaterThanOrEqual(before + LOCKOUT_DURATION_MS);
    expect(lockTime).toBeLessThanOrEqual(after + LOCKOUT_DURATION_MS);
  });

  it('resets failedLoginAttempts on successful login', async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 5 });
    mocks.bcryptCompare.mockResolvedValue(true);

    const result = await authorizeCredentials({ email: 'test@example.com', password: 'correct' });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-1');
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date),
      },
    });
  });

  it('allows login after lock has expired', async () => {
    const expiredLockUser = {
      ...baseUser,
      failedLoginAttempts: 10,
      lockedUntil: new Date(Date.now() - 1000), // expired 1 second ago
    };
    mocks.findUnique.mockResolvedValue(expiredLockUser);
    mocks.bcryptCompare.mockResolvedValue(true);

    const result = await authorizeCredentials({ email: 'test@example.com', password: 'correct' });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('user-1');
    // Should reset failed attempts
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date),
      },
    });
  });

  it('returns null for missing credentials', async () => {
    const result = await authorizeCredentials({ email: '', password: '' });
    expect(result).toBeNull();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for non-existent user', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await authorizeCredentials({ email: 'nobody@example.com', password: 'pass' });
    expect(result).toBeNull();
  });

  it('exports correct constants', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(10);
    expect(LOCKOUT_DURATION_MS).toBe(30 * 60 * 1000);
  });

  it('sends lockout email notification on the 10th failed attempt', async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 9 });
    mocks.bcryptCompare.mockResolvedValue(false);

    await authorizeCredentials({ email: 'test@example.com', password: 'wrong' });

    // Allow the non-blocking promise chain to resolve
    await vi.waitFor(() => {
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Account temporarily locked',
        text: expect.stringContaining('temporarily locked'),
      })
    );
  });

  it('does not send lockout email before reaching threshold', async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, failedLoginAttempts: 7 });
    mocks.bcryptCompare.mockResolvedValue(false);

    await authorizeCredentials({ email: 'test@example.com', password: 'wrong' });

    // Give a tick for any potential async to resolve
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
