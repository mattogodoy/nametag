import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  id: string;
  userId: string;
  name: string;
  platform: 'IOS' | 'ANDROID';
  appVersion: string;
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  idleExpiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
}

const db = vi.hoisted(() => ({ rows: [] as Row[], seq: 0, lastUsedUpdates: 0 }));

type Where = Partial<Record<keyof Row, unknown>> & { idleExpiresAt?: { lt: Date }; id?: unknown };

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'idleExpiresAt' && value && typeof value === 'object' && 'lt' in value) {
      return row.idleExpiresAt < (value as { lt: Date }).lt;
    }
    if (key === 'id' && value && typeof value === 'object' && 'not' in value) {
      return row.id !== (value as { not: string }).not;
    }
    return row[key as keyof Row] === value;
  });
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    deviceSession: {
      create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'lastUsedAt' | 'createdAt' | 'previousRefreshTokenHash' | 'rotatedAt'> }) => {
        const row: Row = {
          ...data,
          id: `s${++db.seq}`,
          previousRefreshTokenHash: null,
          rotatedAt: null,
          lastUsedAt: new Date(0),
          createdAt: new Date(0),
        };
        db.rows.push(row);
        return row;
      }),
      // Return copies, like a real database: a caller holding a row must not see later writes.
      findUnique: vi.fn(async ({ where }: { where: Where }) => {
        const row = db.rows.find((r) => matches(r, where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: { where: Where }) => db.rows.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
      updateMany: vi.fn(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hits = db.rows.filter((r) => matches(r, where));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = db.rows.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        if ('lastUsedAt' in data) db.lastUsedUpdates++;
        Object.assign(row, data);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        const before = db.rows.length;
        db.rows = db.rows.filter((r) => !matches(r, where));
        return { count: before - db.rows.length };
      }),
    },
  },
}));

const mockLog = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: mockLog, createModuleLogger: vi.fn(() => mockLog) }));

import {
  createDeviceSession,
  resolveDeviceAccessToken,
  refreshDeviceSession,
  listDeviceSessions,
  revokeDeviceSession,
  revokeOtherDeviceSessions,
  deleteIdleDeviceSessions,
} from '@/lib/native-auth/sessions';
import { IDLE_TTL_MS, REUSE_GRACE_MS, LAST_USED_THROTTLE_MS } from '@/lib/native-auth/tokens';

const device = { name: "Matto's iPhone", platform: 'IOS' as const, appVersion: '1.0.0' };
const t0 = new Date('2026-10-17T10:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('device sessions', () => {
  beforeEach(() => {
    db.rows = [];
    db.seq = 0;
    db.lastUsedUpdates = 0;
    vi.clearAllMocks();
  });

  describe('createDeviceSession', () => {
    it('stores hashes only and returns the plaintext once', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      const row = db.rows[0];
      expect(row.accessTokenHash).not.toContain(issued.accessToken);
      expect(JSON.stringify(row)).not.toContain(issued.refreshToken);
      expect(row.idleExpiresAt.getTime()).toBe(t0.getTime() + IDLE_TTL_MS);
      expect(issued.sessionId).toBe(row.id);
    });
  });

  describe('resolveDeviceAccessToken', () => {
    it('resolves a fresh access token to its user and session', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      expect(await resolveDeviceAccessToken(issued.accessToken, at(1000))).toEqual({
        status: 'ok',
        userId: 'u1',
        sessionId: issued.sessionId,
      });
    });

    it('reports expired one hour after issue', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      expect((await resolveDeviceAccessToken(issued.accessToken, at(60 * 60 * 1000))).status).toBe('expired');
      expect((await resolveDeviceAccessToken(issued.accessToken, at(60 * 60 * 1000 - 1))).status).toBe('ok');
    });

    it('reports invalid for unknown, refresh or foreign-prefix tokens', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      expect((await resolveDeviceAccessToken('ntsa_nope', t0)).status).toBe('invalid');
      expect((await resolveDeviceAccessToken(issued.refreshToken, t0)).status).toBe('invalid');
      expect((await resolveDeviceAccessToken('ntag_abc', t0)).status).toBe('invalid');
    });

    it('writes lastUsedAt at most once per five minutes', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      await resolveDeviceAccessToken(issued.accessToken, at(1000));
      await resolveDeviceAccessToken(issued.accessToken, at(2000));
      await resolveDeviceAccessToken(issued.accessToken, at(1000 + LAST_USED_THROTTLE_MS - 1));
      expect(db.lastUsedUpdates).toBe(1);
      await resolveDeviceAccessToken(issued.accessToken, at(1000 + LAST_USED_THROTTLE_MS + 1));
      expect(db.lastUsedUpdates).toBe(2);
    });
  });

  describe('refreshDeviceSession', () => {
    it('rule 1: rotates both tokens and extends the idle window', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      const result = await refreshDeviceSession(issued.refreshToken, at(10_000));
      if (result.status !== 'ok') throw new Error('expected ok');
      expect(result.userId).toBe('u1');
      expect(result.session.sessionId).toBe(issued.sessionId);
      expect(result.session.refreshToken).not.toBe(issued.refreshToken);
      expect((await resolveDeviceAccessToken(issued.accessToken, at(10_001))).status).toBe('invalid');
      expect((await resolveDeviceAccessToken(result.session.accessToken, at(10_001))).status).toBe('ok');
      expect(db.rows[0].idleExpiresAt.getTime()).toBe(at(10_000).getTime() + IDLE_TTL_MS);
    });

    it('rule 2: replaying the previous token within 60 seconds issues a fresh pair', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      const lost = await refreshDeviceSession(issued.refreshToken, at(1000));
      const retry = await refreshDeviceSession(issued.refreshToken, at(1000 + REUSE_GRACE_MS));
      if (lost.status !== 'ok' || retry.status !== 'ok') throw new Error('expected ok');
      // The pair the client never received is dead.
      expect((await refreshDeviceSession(lost.session.refreshToken, at(1000 + REUSE_GRACE_MS + 1))).status).toBe('expired');
    });

    it('rule 2: a second replay inside the same window still succeeds (Review Focus 1)', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      await refreshDeviceSession(issued.refreshToken, at(1000));
      expect((await refreshDeviceSession(issued.refreshToken, at(5000))).status).toBe('ok');
      expect((await refreshDeviceSession(issued.refreshToken, at(9000))).status).toBe('ok');
      expect(db.rows).toHaveLength(1);
    });

    it('rule 3: replaying the previous token after 60 seconds deletes the session', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      const fresh = await refreshDeviceSession(issued.refreshToken, at(1000));
      if (fresh.status !== 'ok') throw new Error('expected ok');
      expect((await refreshDeviceSession(issued.refreshToken, at(1000 + REUSE_GRACE_MS + 1))).status).toBe('expired');
      expect(db.rows).toHaveLength(0);
      expect((await refreshDeviceSession(fresh.session.refreshToken, at(1000 + REUSE_GRACE_MS + 2))).status).toBe('expired');
      expect(mockLog.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.native.refresh_reuse', userId: 'u1' }),
        expect.any(String)
      );
    });

    it('rule 4: unknown tokens and idle sessions are expired, and idle rows are deleted', async () => {
      expect((await refreshDeviceSession('ntsr_unknown', t0)).status).toBe('expired');
      expect((await refreshDeviceSession('garbage', t0)).status).toBe('expired');
      const issued = await createDeviceSession('u1', device, t0);
      expect((await refreshDeviceSession(issued.refreshToken, at(IDLE_TTL_MS))).status).toBe('expired');
      expect(db.rows).toHaveLength(0);
    });

    it('concurrent refreshes: the loser falls into the grace rule instead of signing out', async () => {
      const issued = await createDeviceSession('u1', device, t0);
      const [a, b] = await Promise.all([
        refreshDeviceSession(issued.refreshToken, at(1000)),
        refreshDeviceSession(issued.refreshToken, at(1000)),
      ]);
      expect(a.status).toBe('ok');
      expect(b.status).toBe('ok');
      expect(db.rows).toHaveLength(1);
    });
  });

  describe('listing and revoking', () => {
    it('lists only the user\'s sessions without token hashes', async () => {
      await createDeviceSession('u1', device, t0);
      await createDeviceSession('u2', device, t0);
      const list = await listDeviceSessions('u1');
      expect(list).toHaveLength(1);
      expect(Object.keys(list[0]).sort()).toEqual(['appVersion', 'createdAt', 'id', 'lastUsedAt', 'name', 'platform']);
    });

    it('never revokes another user\'s session', async () => {
      const other = await createDeviceSession('u2', device, t0);
      expect(await revokeDeviceSession('u1', other.sessionId)).toBe(false);
      expect(db.rows).toHaveLength(1);
      expect(await revokeDeviceSession('u2', other.sessionId)).toBe(true);
      expect(db.rows).toHaveLength(0);
    });

    it('revokes all other sessions and keeps the caller', async () => {
      const mine = await createDeviceSession('u1', device, t0);
      await createDeviceSession('u1', device, t0);
      await createDeviceSession('u2', device, t0);
      expect(await revokeOtherDeviceSessions('u1', mine.sessionId)).toBe(1);
      expect(db.rows.map((r) => r.id).sort()).toEqual([mine.sessionId, 's3'].sort());
      expect(await revokeOtherDeviceSessions('u2', null)).toBe(1);
    });

    it('deletes idle sessions in the purge job', async () => {
      await createDeviceSession('u1', device, t0);
      expect(await deleteIdleDeviceSessions(at(IDLE_TTL_MS - 1))).toBe(0);
      expect(await deleteIdleDeviceSessions(at(IDLE_TTL_MS + 1))).toBe(1);
    });
  });
});
