import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { getChangesSince, type SyncPage } from '@/lib/sync/changes';

async function drain(userId: string, limit: number): Promise<SyncPage[]> {
  const pages: SyncPage[] = [];
  let cursor = BigInt(0);
  for (let i = 0; i < 100; i++) {
    const page = await getChangesSince(testPrisma, userId, cursor, limit);
    pages.push(page);
    cursor = BigInt(page.cursor);
    if (!page.hasMore) break;
  }
  return pages;
}

function ids(pages: SyncPage[]): string[] {
  return pages.flatMap((p) => [
    ...Object.values(p.changes).flat().map((r) => String(r.id)),
    ...p.deleted.map((d) => d.id),
  ]);
}

describe('getChangesSince', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('returns every change exactly once across mixed-type pages', async () => {
    const created: string[] = [];
    for (let i = 0; i < 4; i++) {
      created.push((await testPrisma.person.create({ data: { userId, name: `P${i}` } })).id);
      created.push((await testPrisma.group.create({ data: { userId, name: `G${i}` } })).id);
    }
    const gone = await testPrisma.group.create({ data: { userId, name: 'Gone' } });
    await testPrisma.group.delete({ where: { id: gone.id } });
    created.push(gone.id); // appears once, as a tombstone

    const seen = ids(await drain(userId, 3));
    expect(seen.sort()).toEqual(created.sort());
  });

  it('includes soft-deleted rows with deletedAt set', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    await testPrisma.person.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    const page = await getChangesSince(testPrisma, userId, BigInt(0), 500);
    expect(page.changes.people[0].deletedAt).not.toBeNull();
  });

  it('serializes bigints as strings and survives JSON.stringify', async () => {
    await testPrisma.person.create({ data: { userId, name: 'A' } });
    const page = await getChangesSince(testPrisma, userId, BigInt(0), 500);
    expect(typeof page.changes.people[0].syncVersion).toBe('string');
    expect(() => JSON.stringify(page)).not.toThrow();
  });

  it('returns person children and group ids', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
    await testPrisma.personPhone.create({ data: { personId: p.id, type: 'mobile', number: '1' } });
    await testPrisma.personGroup.create({ data: { personId: p.id, groupId: g.id } });
    const page = await getChangesSince(testPrisma, userId, BigInt(0), 500);
    const person = page.changes.people.find((r) => r.id === p.id);
    expect(person?.phoneNumbers).toHaveLength(1);
    expect(person?.groupIds).toEqual([g.id]);
  });

  it('never returns another user\'s rows, including person-owned tables', async () => {
    const other = (await createUser()).id;
    const a = await testPrisma.person.create({ data: { userId: other, name: 'X' } });
    await testPrisma.importantDate.create({ data: { personId: a.id, title: 'B', date: new Date('2000-01-01') } });
    const page = await getChangesSince(testPrisma, userId, BigInt(0), 500);
    expect(ids([page])).toEqual([]);
  });

  it('pages exactly at the limit boundary', async () => {
    for (let i = 0; i < 3; i++) await testPrisma.group.create({ data: { userId, name: `G${i}` } });
    const exact = await getChangesSince(testPrisma, userId, BigInt(0), 3);
    expect(exact.hasMore).toBe(false);
    await testPrisma.group.create({ data: { userId, name: 'G3' } });
    const over = await getChangesSince(testPrisma, userId, BigInt(0), 3);
    expect(over.hasMore).toBe(true);
    const next = await getChangesSince(testPrisma, userId, BigInt(over.cursor), 3);
    expect(next.changes.groups.map((g) => g.name)).toEqual(['G3']);
    expect(next.hasMore).toBe(false);
  });

  it('returns the same cursor and an empty page when nothing changed', async () => {
    await testPrisma.group.create({ data: { userId, name: 'G' } });
    const first = await getChangesSince(testPrisma, userId, BigInt(0), 500);
    const again = await getChangesSince(testPrisma, userId, BigInt(first.cursor), 500);
    expect(again.cursor).toBe(first.cursor);
    expect(ids([again])).toEqual([]);
  });

  it('opts back in to syncVersion on the real app client, which omits it', async () => {
    const { prismaIncludingDeleted } = await import('@/lib/prisma');
    for (let i = 0; i < 3; i++) await testPrisma.group.create({ data: { userId, name: `G${i}` } });
    const first = await getChangesSince(prismaIncludingDeleted, userId, BigInt(0), 2);
    expect(first.changes.groups.map((g) => typeof g.syncVersion)).toEqual(['string', 'string']);
    expect(first.hasMore).toBe(true);
    const next = await getChangesSince(prismaIncludingDeleted, userId, BigInt(first.cursor), 2);
    expect(next.changes.groups.map((g) => g.name)).toEqual(['G2']);
    expect(next.hasMore).toBe(false);
    await prismaIncludingDeleted.$disconnect();
  });
});
