import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    deviceSession: { deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/redis', () => ({ isRedisConnected: () => false, getRedis: () => null }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import {
  invalidateUserSessions,
  getSessionsInvalidatedAt,
  isIssuedBeforeCutoff,
  shouldRejectJwt,
  __resetSessionInvalidationCacheForTests,
} from '@/lib/session-invalidation';

describe('session invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    __resetSessionInvalidationCacheForTests();
    mocks.update.mockReturnValue('update-op');
    mocks.deleteMany.mockReturnValue('delete-op');
    mocks.transaction.mockResolvedValue([]);
  });

  it('updates the password, stamps the cut-off and deletes device sessions in one transaction', async () => {
    const now = new Date('2026-10-17T10:00:00.500Z');
    await invalidateUserSessions('u1', 'hash', { passwordResetToken: null }, now);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'hash', sessionsInvalidatedAt: now, passwordResetToken: null },
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(mocks.transaction).toHaveBeenCalledWith(['update-op', 'delete-op']);
  });

  it('serves the new cut-off from cache right after invalidating, without a database read', async () => {
    const now = new Date('2026-10-17T10:00:00.000Z');
    await invalidateUserSessions('u1', 'hash', {}, now);
    expect(await getSessionsInvalidatedAt('u1')).toEqual(now);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('caches database reads for 60 seconds, including "never invalidated"', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T10:00:00.000Z'));
    mocks.findUnique.mockResolvedValue({ sessionsInvalidatedAt: null });

    expect(await getSessionsInvalidatedAt('u1')).toBeNull();
    expect(await getSessionsInvalidatedAt('u1')).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-17T10:01:00.001Z'));
    await getSessionsInvalidatedAt('u1');
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  describe('isIssuedBeforeCutoff', () => {
    const cutoff = new Date('2026-10-17T10:00:00.700Z'); // 700 ms into its second

    it('accepts any token when there is no cut-off', () => {
      expect(isIssuedBeforeCutoff(1, null)).toBe(false);
    });

    it('rejects tokens issued in an earlier second', () => {
      expect(isIssuedBeforeCutoff(Math.floor(cutoff.getTime() / 1000) - 1, cutoff)).toBe(true);
    });

    it('accepts a token issued in the same second (the re-sign-in after the change)', () => {
      expect(isIssuedBeforeCutoff(Math.floor(cutoff.getTime() / 1000), cutoff)).toBe(false);
    });

    it('rejects a token with no iat once a cut-off exists', () => {
      expect(isIssuedBeforeCutoff(undefined, cutoff)).toBe(true);
    });
  });

  describe('shouldRejectJwt', () => {
    it('rejects a token issued before the cut-off and accepts one after', async () => {
      mocks.findUnique.mockResolvedValue({ sessionsInvalidatedAt: null });
      const now = new Date('2026-10-17T10:00:00.000Z');
      await invalidateUserSessions('u1', 'hash', {}, now);
      const second = Math.floor(now.getTime() / 1000);
      expect(await shouldRejectJwt({ id: 'u1', iat: second - 3600 })).toBe(true);
      expect(await shouldRejectJwt({ id: 'u1', iat: second })).toBe(false);
      expect(await shouldRejectJwt({ id: 'u2', iat: second - 3600 })).toBe(false);
    });

    it('ignores tokens without a user id (sign-in in progress)', async () => {
      expect(await shouldRejectJwt({})).toBe(false);
      expect(mocks.findUnique).not.toHaveBeenCalled();
    });
  });
});
