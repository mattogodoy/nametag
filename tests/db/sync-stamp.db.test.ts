import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

async function seq(userId: string): Promise<bigint> {
  const u = await testPrisma.user.findUniqueOrThrow({ where: { id: userId }, select: { syncSeq: true } });
  return u.syncSeq;
}

describe('sync stamping triggers', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('stamps a person on insert and bumps the counter', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'Ana' } });
    expect(p.syncVersion).toBe(BigInt(1));
    expect(await seq(userId)).toBe(BigInt(1));
  });

  it('restamps on update and on soft delete', async () => {
    const p = await testPrisma.person.create({ data: { userId, name: 'Ana' } });
    const u = await testPrisma.person.update({ where: { id: p.id }, data: { name: 'Ana B' } });
    expect(u.syncVersion).toBe(BigInt(2));
    const d = await testPrisma.person.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    expect(d.syncVersion).toBe(BigInt(3));
  });

  it('stamps every userId-owned table', async () => {
    const g = await testPrisma.group.create({ data: { userId, name: 'G' } });
    const rt = await testPrisma.relationshipType.create({ data: { userId, name: 'FRIEND', label: 'Friend' } });
    const j = await testPrisma.journalEntry.create({ data: { userId, title: 'T', body: 'B', date: new Date() } });
    const t = await testPrisma.customFieldTemplate.create({ data: { userId, name: 'F', slug: 'f', type: 'TEXT' } });
    expect([g.syncVersion, rt.syncVersion, j.syncVersion, t.syncVersion]).toEqual([BigInt(1), BigInt(2), BigInt(3), BigInt(4)]);
  });

  it('stamps person-owned tables through the owning person', async () => {
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const b = await testPrisma.person.create({ data: { userId, name: 'B' } });
    const rt = await testPrisma.relationshipType.create({ data: { userId, name: 'FRIEND', label: 'Friend' } });
    const r = await testPrisma.relationship.create({
      data: { personId: a.id, relatedPersonId: b.id, relationshipTypeId: rt.id },
    });
    const d = await testPrisma.importantDate.create({ data: { personId: a.id, title: 'Bday', date: new Date('2000-01-01') } });
    expect(r.syncVersion).toBe(BigInt(4));
    expect(d.syncVersion).toBe(BigInt(5));
  });

  it('keeps users independent', async () => {
    const other = (await createUser()).id;
    await testPrisma.person.create({ data: { userId, name: 'A' } });
    const p = await testPrisma.person.create({ data: { userId: other, name: 'B' } });
    expect(p.syncVersion).toBe(BigInt(1));
  });
});
