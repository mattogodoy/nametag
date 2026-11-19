import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

async function version(personId: string): Promise<bigint> {
  const p = await testPrisma.person.findUniqueOrThrow({ where: { id: personId }, select: { syncVersion: true } });
  return p.syncVersion;
}

describe('child bumps and tombstones', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('bumps the person when a phone is added, changed and removed', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const v0 = await version(p.id);
    const phone = await testPrisma.personPhone.create({ data: { personId: p.id, type: 'mobile', number: '1' } });
    const v1 = await version(p.id);
    await testPrisma.personPhone.update({ where: { id: phone.id }, data: { number: '2' } });
    const v2 = await version(p.id);
    await testPrisma.personPhone.delete({ where: { id: phone.id } });
    const v3 = await version(p.id);
    expect(v1).toBeGreaterThan(v0);
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('bumps the person when group membership changes', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
    const v0 = await version(p.id);
    await testPrisma.personGroup.create({ data: { personId: p.id, groupId: g.id } });
    expect(await version(p.id)).toBeGreaterThan(v0);
  });

  it('bumps the journal entry when a person tag is added', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const j = await testPrisma.journalEntry.create({ data: { userId, title: 'T', body: 'B', date: new Date() } });
    await testPrisma.journalEntryPerson.create({ data: { journalEntryId: j.id, personId: p.id } });
    const after = await testPrisma.journalEntry.findUniqueOrThrow({ where: { id: j.id } });
    expect(after.syncVersion).toBeGreaterThan(j.syncVersion);
  });

  it('writes a tombstone on hard delete, including cascaded children', async () => {
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const d = await testPrisma.importantDate.create({ data: { personId: a.id, title: 'Bday', date: new Date('2000-01-01') } });
    await testPrisma.person.delete({ where: { id: a.id } });
    const stones = await testPrisma.syncTombstone.findMany({ where: { userId }, orderBy: { syncVersion: 'asc' } });
    expect(stones.map((s) => [s.entityType, s.entityId])).toEqual(
      expect.arrayContaining([['person', a.id], ['importantDate', d.id]])
    );
    const seq = (await testPrisma.user.findUniqueOrThrow({ where: { id: userId } })).syncSeq;
    expect(stones.every((s) => s.syncVersion <= seq)).toBe(true);
  });

  it('writes no tombstone for a soft delete', async () => {
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    await testPrisma.person.update({ where: { id: a.id }, data: { deletedAt: new Date() } });
    expect(await testPrisma.syncTombstone.count({ where: { userId } })).toBe(0);
  });

  it('deletes a whole account without errors or leftover tombstones', async () => {
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    await testPrisma.personPhone.create({ data: { personId: a.id, type: 'mobile', number: '1' } });
    await testPrisma.group.create({ data: { userId, name: 'G' } });
    await testPrisma.user.delete({ where: { id: userId } });
    expect(await testPrisma.syncTombstone.count()).toBe(0);
    expect(await testPrisma.person.count({ where: { userId } })).toBe(0);
  });
});
