import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Row {
  id: string;
  userId: string;
  codeHash: string;
  codeChallenge: string;
  deviceName: string;
  platform: 'IOS' | 'ANDROID';
  appVersion: string;
  expiresAt: Date;
  createdAt: Date;
}

const db = vi.hoisted(() => ({ rows: [] as Row[], seq: 0 }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    nativeAuthCode: {
      create: vi.fn(async ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
        const row: Row = { ...data, id: `c${++db.seq}`, createdAt: new Date(0) };
        db.rows.push(row);
        return { ...row };
      }),
      findUnique: vi.fn(async ({ where }: { where: { codeHash: string } }) => {
        const row = db.rows.find((r) => r.codeHash === where.codeHash);
        return row ? { ...row } : null;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { id?: string; expiresAt?: { lt: Date } } }) => {
        const before = db.rows.length;
        db.rows = db.rows.filter((r) => {
          if (where.id !== undefined) return r.id !== where.id;
          if (where.expiresAt) return !(r.expiresAt < where.expiresAt.lt);
          return true;
        });
        return { count: before - db.rows.length };
      }),
    },
  },
}));

import { issueNativeAuthCode, consumeNativeAuthCode, deleteExpiredNativeAuthCodes, CODE_TTL_MS } from '@/lib/native-auth/codes';
import { challengeFromVerifier } from '@/lib/native-auth/pkce';

const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const pending = {
  codeChallenge: challengeFromVerifier(VERIFIER),
  device: { name: 'Pixel', platform: 'ANDROID' as const, appVersion: '1.0.0' },
};
const t0 = new Date('2026-10-17T10:00:00.000Z');
const at = (ms: number) => new Date(t0.getTime() + ms);

describe('native auth codes', () => {
  beforeEach(() => {
    db.rows = [];
    db.seq = 0;
  });

  it('issues an ntc_ code and stores only its hash', async () => {
    const code = await issueNativeAuthCode('u1', pending, t0);
    expect(code.startsWith('ntc_')).toBe(true);
    expect(JSON.stringify(db.rows)).not.toContain(code);
    expect(db.rows[0].expiresAt.getTime()).toBe(t0.getTime() + CODE_TTL_MS);
  });

  it('exchanges once with the right verifier', async () => {
    const code = await issueNativeAuthCode('u1', pending, t0);
    expect(await consumeNativeAuthCode(code, VERIFIER, at(1000))).toEqual({
      status: 'ok',
      userId: 'u1',
      device: pending.device,
    });
    expect(await consumeNativeAuthCode(code, VERIFIER, at(2000))).toEqual({ status: 'invalid', reason: 'unknown' });
  });

  it('rejects at the 60-second boundary', async () => {
    const code = await issueNativeAuthCode('u1', pending, t0);
    expect(await consumeNativeAuthCode(code, VERIFIER, at(CODE_TTL_MS))).toEqual({ status: 'invalid', reason: 'expired' });
    const fresh = await issueNativeAuthCode('u1', pending, t0);
    expect((await consumeNativeAuthCode(fresh, VERIFIER, at(CODE_TTL_MS - 1))).status).toBe('ok');
  });

  it('burns the code on a wrong verifier', async () => {
    const code = await issueNativeAuthCode('u1', pending, t0);
    expect(await consumeNativeAuthCode(code, 'x'.repeat(43), at(1000))).toEqual({ status: 'invalid', reason: 'verifier' });
    expect(await consumeNativeAuthCode(code, VERIFIER, at(1001))).toEqual({ status: 'invalid', reason: 'unknown' });
  });

  it('rejects unknown and foreign-prefix codes', async () => {
    expect(await consumeNativeAuthCode('ntc_nope', VERIFIER, t0)).toEqual({ status: 'invalid', reason: 'unknown' });
    expect(await consumeNativeAuthCode('ntsa_abc', VERIFIER, t0)).toEqual({ status: 'invalid', reason: 'unknown' });
  });

  it('lets exactly one of two concurrent exchanges succeed (Review Focus 3)', async () => {
    const code = await issueNativeAuthCode('u1', pending, t0);
    const results = await Promise.all([
      consumeNativeAuthCode(code, VERIFIER, at(1000)),
      consumeNativeAuthCode(code, VERIFIER, at(1000)),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['invalid', 'ok']);
  });

  it('purges expired codes', async () => {
    await issueNativeAuthCode('u1', pending, t0);
    expect(await deleteExpiredNativeAuthCodes(at(CODE_TTL_MS - 1))).toBe(0);
    expect(await deleteExpiredNativeAuthCodes(at(CODE_TTL_MS + 1))).toBe(1);
  });
});
