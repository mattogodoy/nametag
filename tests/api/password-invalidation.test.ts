import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/session-invalidation', () => ({ invalidateUserSessions: mocks.invalidate }));
vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.findUnique, findFirst: mocks.findFirst, update: mocks.update } },
}));
vi.mock('bcryptjs', () => ({ compare: vi.fn(async () => true), hash: vi.fn(async () => 'new-hash') }));
vi.mock('@/lib/features', () => ({ isFeatureEnabled: () => true, isSaasMode: () => false }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null }));
vi.mock('@/lib/csrf', () => ({ validateOrigin: () => true }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) => handler(req, { user: { id: 'u1' }, authMethod: 'session' }, { params: Promise.resolve({}) }),
  };
});
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { PUT as changePassword } from '@/app/api/user/password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';

const json = (body: unknown) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('password changes sign out everywhere', () => {
  beforeEach(() => vi.clearAllMocks());

  it('a password change invalidates all sessions with the new hash', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'u1', password: 'old-hash' });
    const res = await changePassword(
      new Request('http://localhost/api/user/password', { method: 'PUT', ...json({ currentPassword: 'Old1!pass', newPassword: 'New1!passw' }) })
    );
    expect(res.status).toBe(200);
    expect(mocks.invalidate).toHaveBeenCalledWith('u1', 'new-hash');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('a password reset invalidates all sessions and clears the reset token', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'u1' });
    const res = await resetPassword(
      new Request('http://localhost/api/auth/reset-password', { method: 'POST', ...json({ token: 'tok', password: 'New1!passw' }) })
    );
    expect(res.status).toBe(200);
    expect(mocks.invalidate).toHaveBeenCalledWith('u1', 'new-hash', {
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordResetSentAt: null,
    });
  });
});
