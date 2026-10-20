import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

// './client' sets DATABASE_URL from TEST_DATABASE_URL, so import the real
// client lazily, after it.
async function realPrisma() {
  return (await import('@/lib/prisma')).prisma;
}

describe('global omit of sync internals', () => {
  let userId: string;
  let personId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
    personId = (await testPrisma.person.create({ data: { userId, name: 'Ana' } })).id;
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
    await (await realPrisma()).$disconnect();
  });

  it('hides syncVersion on person reads so rows serialize', async () => {
    const prisma = await realPrisma();
    const row = await prisma.person.findFirst({ where: { id: personId }, include: { groups: true } });
    expect(row).not.toBeNull();
    expect('syncVersion' in (row as object)).toBe(false);
    expect(() => JSON.stringify(row)).not.toThrow();
  });

  it('hides syncSeq and syncTombstoneFloor on user reads', async () => {
    const prisma = await realPrisma();
    const row = await prisma.user.findUnique({ where: { id: userId } });
    expect(row).not.toBeNull();
    expect('syncSeq' in (row as object)).toBe(false);
    expect('syncTombstoneFloor' in (row as object)).toBe(false);
    expect(() => JSON.stringify(row)).not.toThrow();
  });

  it('lets a query opt back in with omit false', async () => {
    const prisma = await realPrisma();
    const row = await prisma.person.findFirst({ where: { id: personId }, omit: { syncVersion: false } });
    expect(typeof row?.syncVersion).toBe('bigint');
  });
});
