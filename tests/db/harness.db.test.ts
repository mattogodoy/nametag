import { describe, it, expect, afterAll } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

describe('db test harness', () => {
  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('talks to a migrated database', async () => {
    const user = await createUser();
    const found = await testPrisma.user.findUnique({ where: { id: user.id } });
    expect(found?.id).toBe(user.id);
  });
});
