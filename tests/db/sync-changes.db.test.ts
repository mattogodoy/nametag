import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { getChangesSince, parseSyncCursor, type SyncCursor, type SyncPage } from '@/lib/sync/changes';
import { purgeTombstones } from '@/lib/sync/tombstones';
import { getPage } from './sync-helpers';

type Client = Parameters<typeof getChangesSince>[0];

async function drain(userId: string, limit: number, client: Client = testPrisma): Promise<SyncPage[]> {
  const pages: SyncPage[] = [];
  let cursor = BigInt(0);
  for (let i = 0; i < 100; i++) {
    const page = await getPage(client, userId, cursor, limit);
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
    await (await import('@/lib/prisma')).prismaIncludingDeleted.$disconnect();
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
    const page = await getPage(testPrisma, userId, BigInt(0), 500);
    expect(page.changes.people[0].deletedAt).not.toBeNull();
  });

  it('serializes bigints as strings and survives JSON.stringify', async () => {
    await testPrisma.person.create({ data: { userId, name: 'A' } });
    const page = await getPage(testPrisma, userId, BigInt(0), 500);
    expect(typeof page.changes.people[0].syncVersion).toBe('string');
    expect(() => JSON.stringify(page)).not.toThrow();
  });

  it('returns person children and group ids', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
    await testPrisma.personPhone.create({ data: { personId: p.id, type: 'mobile', number: '1' } });
    await testPrisma.personGroup.create({ data: { personId: p.id, groupId: g.id } });
    const page = await getPage(testPrisma, userId, BigInt(0), 500);
    const person = page.changes.people.find((r) => r.id === p.id);
    expect(person?.phoneNumbers).toHaveLength(1);
    expect(person?.groupIds).toEqual([g.id]);
  });

  it('never returns another user\'s rows, including person-owned tables', async () => {
    const other = (await createUser()).id;
    const a = await testPrisma.person.create({ data: { userId: other, name: 'X' } });
    await testPrisma.importantDate.create({ data: { personId: a.id, title: 'B', date: new Date('2000-01-01') } });
    const page = await getPage(testPrisma, userId, BigInt(0), 500);
    expect(ids([page])).toEqual([]);
  });

  it('pages exactly at the limit boundary', async () => {
    for (let i = 0; i < 3; i++) await testPrisma.group.create({ data: { userId, name: `G${i}` } });
    const exact = await getPage(testPrisma, userId, BigInt(0), 3);
    expect(exact.hasMore).toBe(false);
    await testPrisma.group.create({ data: { userId, name: 'G3' } });
    const over = await getPage(testPrisma, userId, BigInt(0), 3);
    expect(over.hasMore).toBe(true);
    const next = await getPage(testPrisma, userId, BigInt(over.cursor), 3);
    expect(next.changes.groups.map((g) => g.name)).toEqual(['G3']);
    expect(next.hasMore).toBe(false);
  });

  it('returns the same cursor and an empty page when nothing changed', async () => {
    await testPrisma.group.create({ data: { userId, name: 'G' } });
    const first = await getPage(testPrisma, userId, BigInt(0), 500);
    const again = await getPage(testPrisma, userId, BigInt(first.cursor), 500);
    expect(again.cursor).toBe(first.cursor);
    expect(ids([again])).toEqual([]);
  });

  it('opts back in to syncVersion on every table with the real app client, which omits it', async () => {
    const { prismaIncludingDeleted } = await import('@/lib/prisma');
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const b = await testPrisma.person.create({ data: { userId, name: 'B' } });
    const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
    const t = await testPrisma.relationshipType.create({ data: { userId, name: 'FRIEND', label: 'Friend' } });
    const r = await testPrisma.relationship.create({
      data: { personId: a.id, relatedPersonId: b.id, relationshipTypeId: t.id },
    });
    const d = await testPrisma.importantDate.create({ data: { personId: a.id, title: 'B', date: new Date('2000-01-01') } });
    const j = await testPrisma.journalEntry.create({ data: { userId, title: 'J', date: new Date(), body: 'x' } });
    const c = await testPrisma.customFieldTemplate.create({ data: { userId, name: 'C', slug: 'c', type: 'TEXT' } });
    const created = [a.id, b.id, g.id, t.id, r.id, d.id, j.id, c.id];

    const pages = await drain(userId, 2, prismaIncludingDeleted);
    expect(pages.length).toBeGreaterThan(1);
    const records = pages.flatMap((p) => Object.values(p.changes).flat());
    expect(records.map((x) => typeof x.syncVersion)).toEqual(created.map(() => 'string'));
    expect(ids(pages).sort()).toEqual(created.sort());
  });

  it('returns custom field values whose template is in the trash', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const tpl = await testPrisma.customFieldTemplate.create({ data: { userId, name: 'C', slug: 'c', type: 'TEXT' } });
    await testPrisma.personCustomFieldValue.create({ data: { personId: p.id, templateId: tpl.id, value: 'v' } });
    await testPrisma.customFieldTemplate.update({ where: { id: tpl.id }, data: { deletedAt: new Date() } });
    const page = await getPage(testPrisma, userId, BigInt(0), 500);
    const person = page.changes.people.find((x) => x.id === p.id);
    expect(person?.customFieldValues).toEqual([expect.objectContaining({ templateId: tpl.id, value: 'v' })]);
  });

  describe('cursor checks inside the snapshot', () => {
    it('answers expired when the floor is above a nonzero cursor', async () => {
      await testPrisma.user.update({ where: { id: userId }, data: { syncSeq: BigInt(10), syncTombstoneFloor: BigInt(5) } });
      expect(await getChangesSince(testPrisma, userId, BigInt(4), 500)).toEqual({ status: 'expired' });
    });

    it('treats a cursor equal to the floor and cursor 0 as valid', async () => {
      await testPrisma.user.update({ where: { id: userId }, data: { syncSeq: BigInt(10), syncTombstoneFloor: BigInt(5) } });
      expect((await getChangesSince(testPrisma, userId, BigInt(5), 500)).status).toBe('ok');
      expect((await getChangesSince(testPrisma, userId, BigInt(0), 500)).status).toBe('ok');
    });

    describe('full sync below the floor', () => {
      // Two live contacts at versions 1 and 2, then a deletion whose tombstone
      // is purged, raising the floor above both (the review's reproduction).
      async function seedPurgedFloor(): Promise<bigint> {
        await testPrisma.group.create({ data: { userId, name: 'a' } });
        await testPrisma.group.create({ data: { userId, name: 'b' } });
        const gone = await testPrisma.group.create({ data: { userId, name: 'gone' } });
        await testPrisma.group.delete({ where: { id: gone.id } });
        await testPrisma.syncTombstone.updateMany({ where: { userId }, data: { deletedAt: new Date('2020-01-01') } });
        await purgeTombstones(testPrisma, new Date('2021-01-01'));
        const { syncTombstoneFloor } = await testPrisma.user.findUniqueOrThrow({ where: { id: userId } });
        expect(syncTombstoneFloor).toBe(BigInt(4));
        return syncTombstoneFloor;
      }

      async function pageAt(raw: string, limit: number) {
        const cursor = parseSyncCursor(raw) as SyncCursor;
        expect(cursor).not.toBeNull();
        return getChangesSince(testPrisma, userId, cursor, limit);
      }

      it('pages a full sync one record at a time past the floor', async () => {
        await seedPurgedFloor();
        const seen: string[] = [];
        let raw = '0';
        for (let i = 0; i < 10; i++) {
          const result = await pageAt(raw, 1);
          if (result.status !== 'ok') throw new Error(`page ${i} from ${raw}: ${result.status}`);
          seen.push(...result.page.changes.groups.map((g) => String(g.name)));
          raw = result.page.cursor;
          if (!result.page.hasMore) break;
        }
        expect(seen).toEqual(['a', 'b']);
        // The first page is below the floor, so it carries it; the last is plain.
        expect(raw).toBe('4');
      });

      it('marks a below-floor page cursor with the floor and a plain one without', async () => {
        await seedPurgedFloor();
        const first = await pageAt('0', 1);
        expect(first.status === 'ok' && first.page.cursor).toBe('1:4');
      });

      it('expires a full-sync cursor once a later purge moves the floor', async () => {
        await seedPurgedFloor();
        const first = await pageAt('0', 1);
        if (first.status !== 'ok') throw new Error(first.status);
        const g = await testPrisma.group.create({ data: { userId, name: 'later' } });
        await testPrisma.group.delete({ where: { id: g.id } });
        await testPrisma.syncTombstone.updateMany({ where: { userId }, data: { deletedAt: new Date('2020-01-01') } });
        await purgeTombstones(testPrisma, new Date('2021-01-01'));
        expect(await pageAt(first.page.cursor, 1)).toEqual({ status: 'expired' });
      });

      it('still expires a plain incremental cursor below the floor', async () => {
        await seedPurgedFloor();
        expect(await pageAt('1', 1)).toEqual({ status: 'expired' });
      });
    });

    it('answers ahead when the cursor is beyond syncSeq', async () => {
      const { syncSeq } = await testPrisma.user.findUniqueOrThrow({ where: { id: userId }, select: { syncSeq: true } });
      expect(await getChangesSince(testPrisma, userId, syncSeq + BigInt(1), 500)).toEqual({ status: 'ahead' });
    });

    it('answers no_user for an unknown user', async () => {
      expect(await getChangesSince(testPrisma, 'no-such-user', BigInt(0), 500)).toEqual({ status: 'no_user' });
    });
  });
});
