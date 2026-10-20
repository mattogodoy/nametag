import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

const authState = vi.hoisted(() => ({ userId: '' }));

// Only auth is mocked: the route, withAuth, the real prisma client (with its
// client-wide omit) and the real database all run for real.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: authState.userId, email: 'a@b.c', name: 'A' } })),
}));

import { GET } from '@/app/api/sync/route';

function call(qs: string) {
  return GET(new Request(`http://localhost/api/sync${qs}`), { params: Promise.resolve({}) });
}

describe('GET /api/sync against the real database', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
    authState.userId = userId;
    for (const name of ['A', 'B', 'C']) {
      await testPrisma.group.create({ data: { userId, name } });
    }
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
    const lib = await import('@/lib/prisma');
    await lib.prisma.$disconnect();
    await lib.prismaIncludingDeleted.$disconnect();
  });

  it('rejects a cursor ahead of syncSeq with 400 invalid_query', async () => {
    const res = await call('?cursor=4');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('invalid_query');
    expect(body.params.param).toBe('cursor');
  });

  it('returns every group from cursor 0 with a string cursor', async () => {
    const res = await call('?cursor=0');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changes.groups).toHaveLength(3);
    expect(body.cursor).toBe('3');
    expect(body.hasMore).toBe(false);
  });

  it('returns 410 below the tombstone floor, and 200 at it or from 0', async () => {
    await testPrisma.user.update({ where: { id: userId }, data: { syncTombstoneFloor: BigInt(2) } });

    const expired = await call('?cursor=1');
    expect(expired.status).toBe(410);
    expect((await expired.json()).code).toBe('sync_cursor_expired');

    expect((await call('?cursor=2')).status).toBe(200);
    expect((await call('?cursor=0')).status).toBe(200);
  });
});
