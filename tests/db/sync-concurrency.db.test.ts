import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('sync ordering under concurrency', () => {
  let userId: string;

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
  });

  it('a later writer waits for an open one, so versions follow commit order', async () => {
    const a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const b = await testPrisma.person.create({ data: { userId, name: 'B' } });
    const release = deferred();
    const firstWrote = deferred();

    const slow = testPrisma.$transaction(async (tx) => {
      await tx.person.update({ where: { id: a.id }, data: { name: 'A1' } });
      firstWrote.resolve();
      await release.promise;
    }, { timeout: 15000 });

    let fast: Promise<{ syncVersion: bigint }> | undefined;
    try {
      await firstWrote.promise;
      let fastDone = false;
      fast = testPrisma.person
        .update({ where: { id: b.id }, data: { name: 'B1' } })
        .then((row) => { fastDone = true; return row; });

      // Positive proof of blocking: the update is waiting on a lock in Postgres.
      // (The blocked statement is the top-level UPDATE on people; the trigger's
      // UPDATE on users is what it waits on.)
      let waiting = 0;
      for (let i = 0; i < 100 && waiting < 1; i++) {
        const rows = await testPrisma.$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE wait_event_type = 'Lock'
            AND datname = current_database()
            AND pid <> pg_backend_pid()
            AND query ILIKE '%UPDATE%people%'`;
        waiting = rows[0]?.n ?? 0;
        if (waiting < 1) await new Promise((r) => setTimeout(r, 50));
      }
      expect(waiting).toBeGreaterThanOrEqual(1);
      expect(fastDone).toBe(false);

      release.resolve();
      await slow;
      const fastRow = await fast;
      const aRow = await testPrisma.person.findUniqueOrThrow({ where: { id: a.id } });
      expect(fastRow.syncVersion).toBe(aRow.syncVersion + BigInt(1));
    } finally {
      // Always free the user-row lock, even when an assertion fails, so cleanup does not hang.
      release.resolve();
      await Promise.allSettled([slow, fast ?? Promise.resolve()]);
    }
  });
});
