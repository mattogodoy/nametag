import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  redisConnected: vi.fn(() => false),
  redisGet: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    deviceSession: { deleteMany: mocks.deleteMany },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@/lib/redis', () => ({
  isRedisConnected: () => mocks.redisConnected(),
  getRedis: () => (mocks.redisConnected() ? { get: mocks.redisGet, set: vi.fn() } : null),
}));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: mocks.warn, error: vi.fn() };
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
    mocks.redisConnected.mockReturnValue(false);
    mocks.redisGet.mockReset();
  });

  it('updates the password, stamps the cut-off and deletes device sessions in one transaction', async () => {
    const now = new Date('2026-10-17T10:00:00.500Z');
    await invalidateUserSessions('u1', 'hash', { extra: { passwordResetToken: null }, now });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { password: 'hash', sessionsInvalidatedAt: now, passwordResetToken: null },
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(mocks.transaction).toHaveBeenCalledWith(['update-op', 'delete-op']);
  });

  it('keeps the calling device session when keepDeviceSessionId is given', async () => {
    await invalidateUserSessions('u1', 'hash', { keepDeviceSessionId: 'ds1' });

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', id: { not: 'ds1' } } });
  });

  it('serves the new cut-off from cache right after invalidating, without a database read', async () => {
    const now = new Date('2026-10-17T10:00:00.000Z');
    await invalidateUserSessions('u1', 'hash', { now });
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

  it('reads the database, not stale memory, when Redis is connected but has no entry', async () => {
    mocks.findUnique.mockResolvedValue({ sessionsInvalidatedAt: null });
    await getSessionsInvalidatedAt('u1'); // seeds memory while Redis is disconnected
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);

    const cutoff = new Date('2026-10-17T10:00:00.000Z');
    mocks.findUnique.mockResolvedValue({ sessionsInvalidatedAt: cutoff });
    mocks.redisConnected.mockReturnValue(true);
    mocks.redisGet.mockResolvedValue(null);
    expect(await getSessionsInvalidatedAt('u1')).toEqual(cutoff);
    expect(mocks.findUnique).toHaveBeenCalledTimes(2);
  });

  it('falls back to memory when the Redis call throws', async () => {
    mocks.findUnique.mockResolvedValue({ sessionsInvalidatedAt: null });
    await getSessionsInvalidatedAt('u1');
    mocks.redisConnected.mockReturnValue(true);
    mocks.redisGet.mockRejectedValue(new Error('redis down'));
    expect(await getSessionsInvalidatedAt('u1')).toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledTimes(1);
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
      await invalidateUserSessions('u1', 'hash', { now });
      const second = Math.floor(now.getTime() / 1000);
      expect(await shouldRejectJwt({ id: 'u1', iat: second - 3600 })).toBe(true);
      expect(await shouldRejectJwt({ id: 'u1', iat: second })).toBe(false);
      expect(await shouldRejectJwt({ id: 'u2', iat: second - 3600 })).toBe(false);
    });

    it('rejects a re-encoded cookie: fresh iat but authTime before the cut-off', async () => {
      const now = new Date('2026-10-17T10:00:00.000Z');
      await invalidateUserSessions('u1', 'hash', { now });
      const second = Math.floor(now.getTime() / 1000);
      expect(await shouldRejectJwt({ id: 'u1', iat: second + 5, authTime: second - 3600 })).toBe(true);
    });

    it('accepts a token whose authTime is after the cut-off even with an old iat', async () => {
      const now = new Date('2026-10-17T10:00:00.000Z');
      await invalidateUserSessions('u1', 'hash', { now });
      const second = Math.floor(now.getTime() / 1000);
      expect(await shouldRejectJwt({ id: 'u1', iat: second - 3600, authTime: second + 1 })).toBe(false);
    });

    it('falls back to iat for legacy tokens without authTime', async () => {
      const now = new Date('2026-10-17T10:00:00.000Z');
      await invalidateUserSessions('u1', 'hash', { now });
      const second = Math.floor(now.getTime() / 1000);
      expect(await shouldRejectJwt({ id: 'u1', iat: second - 3600 })).toBe(true);
      expect(await shouldRejectJwt({ id: 'u1', iat: second })).toBe(false);
    });

    it('fails open and logs a warning when the database read throws', async () => {
      mocks.findUnique.mockRejectedValue(new Error('db down'));
      expect(await shouldRejectJwt({ id: 'u9', iat: 1 })).toBe(false);
      expect(mocks.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.sessions_invalidated_check_failed', userId: 'u9' }),
        expect.any(String)
      );
    });

    it('ignores tokens without a user id (sign-in in progress)', async () => {
      expect(await shouldRejectJwt({})).toBe(false);
      expect(mocks.findUnique).not.toHaveBeenCalled();
    });
  });
});
