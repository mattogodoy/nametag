import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { type SyncPage } from '@/lib/sync/changes';
import { getPage } from './sync-helpers';

const synced = [
  'people', 'groups', 'relationship_types', 'journal_entries',
  'custom_field_templates', 'relationships', 'important_dates',
];

async function setTriggers(on: boolean): Promise<void> {
  for (const t of synced) {
    await testPrisma.$executeRawUnsafe(`ALTER TABLE "${t}" ${on ? 'ENABLE' : 'DISABLE'} TRIGGER USER`);
  }
}

/** Inserts one row of every synced type, plus a second person, without stamping. */
async function seed(userId: string): Promise<string[]> {
  const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
  const b = await testPrisma.person.create({ data: { userId, name: 'B' } });
  const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
  const rt = await testPrisma.relationshipType.create({ data: { userId, name: 'FRIEND', label: 'Friend' } });
  const j = await testPrisma.journalEntry.create({ data: { userId, title: 'J', date: new Date(), body: 'b' } });
  const cf = await testPrisma.customFieldTemplate.create({ data: { userId, name: 'F', slug: 'f', type: 'TEXT' } });
  const r = await testPrisma.relationship.create({
    data: { personId: a.id, relatedPersonId: b.id, relationshipTypeId: rt.id },
  });
  const d = await testPrisma.importantDate.create({ data: { personId: a.id, title: 'Birthday', date: new Date() } });
  return [a.id, b.id, g.id, rt.id, j.id, cf.id, r.id, d.id];
}

function pageIds(page: SyncPage): string[] {
  return Object.values(page.changes).flat().map((row) => String(row.id));
}

describe('nametag_sync_backfill', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('numbers rows that predate the triggers so a sync from 0 returns them', async () => {
    const u1 = (await createUser()).id;
    const u2 = (await createUser()).id;
    let rows1: string[] = [];
    let rows2: string[] = [];
    await setTriggers(false);
    try {
      rows1 = await seed(u1);
      rows2 = await seed(u2);
    } finally {
      await setTriggers(true);
    }

    // Starting state of an instance upgrading to delta sync.
    const zero = await testPrisma.person.count({ where: { userId: { in: [u1, u2] }, syncVersion: BigInt(0) } });
    expect(zero).toBe(4);
    await testPrisma.user.updateMany({ data: { syncSeq: BigInt(0) } });

    await testPrisma.$executeRaw`SELECT nametag_sync_backfill()`;

    for (const [userId, rows] of [[u1, rows1], [u2, rows2]] as const) {
      const page = await getPage(testPrisma, userId, BigInt(0), 500);
      const seen = pageIds(page);
      expect(seen.sort()).toEqual([...rows].sort());
      expect(new Set(seen).size).toBe(seen.length);
      expect(page.cursor).toBe(String(rows.length));
      expect(page.hasMore).toBe(false);

      const user = await testPrisma.user.findUniqueOrThrow({ where: { id: userId }, select: { syncSeq: true } });
      expect(user.syncSeq).toBe(BigInt(rows.length));

      const next = await testPrisma.group.create({ data: { userId, name: 'After' } });
      expect(next.syncVersion).toBe(BigInt(rows.length + 1));
    }
  });
});
