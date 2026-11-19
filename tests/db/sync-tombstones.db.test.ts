import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { purgeTombstones } from '@/lib/sync/tombstones';

describe('purgeTombstones', () => {
  beforeEach(async () => { await resetDb(); });
  afterAll(async () => { await resetDb(); await testPrisma.$disconnect(); });

  it('deletes old tombstones and raises each user\'s floor to the highest purged version', async () => {
    const u = (await createUser()).id;
    const other = (await createUser()).id;
    for (const name of ['a', 'b', 'c']) {
      const g = await testPrisma.group.create({ data: { userId: u, name } });
      await testPrisma.group.delete({ where: { id: g.id } });
    }
    const g = await testPrisma.group.create({ data: { userId: other, name: 'x' } });
    await testPrisma.group.delete({ where: { id: g.id } });

    const stones = await testPrisma.syncTombstone.findMany({ where: { userId: u }, orderBy: { syncVersion: 'asc' } });
    const old = new Date('2020-01-01');
    await testPrisma.syncTombstone.updateMany({ where: { id: { in: [stones[0].id, stones[1].id] } }, data: { deletedAt: old } });

    const count = await purgeTombstones(testPrisma, new Date('2021-01-01'));

    expect(count).toBe(2);
    const left = await testPrisma.syncTombstone.findMany({ where: { userId: u } });
    expect(left.map((s) => s.id)).toEqual([stones[2].id]);
    const user = await testPrisma.user.findUniqueOrThrow({ where: { id: u } });
    expect(user.syncTombstoneFloor).toBe(stones[1].syncVersion);
    const otherUser = await testPrisma.user.findUniqueOrThrow({ where: { id: other } });
    expect(otherUser.syncTombstoneFloor).toBe(BigInt(0));
  });
});
