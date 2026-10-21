import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { prisma } from '@/lib/prisma';
import { lockUserRow } from '@/lib/db/user-lock';
import { withDeadlockRetry } from '@/lib/db/deadlock';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

/** Polls until another backend waits on a lock while running a matching query. */
async function waitForLockWait(pattern: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    const rows = await testPrisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND datname = current_database()
        AND pid <> pg_backend_pid() AND query ILIKE ${pattern}`;
    if ((rows[0]?.n ?? 0) > 0) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`no backend waited on a lock for ${pattern}`);
}

describe('concurrent cross-contact writes for one user', () => {
  let userId: string;
  let a: { id: string };
  let b: { id: string };

  beforeEach(async () => {
    await resetDb();
    userId = (await createUser()).id;
    a = await testPrisma.person.create({ data: { userId, name: 'A' } });
    b = await testPrisma.person.create({ data: { userId, name: 'B' } });
  });

  afterAll(async () => {
    await resetDb();
    await testPrisma.$disconnect();
    await prisma.$disconnect();
  });

  // Transaction A holds the user lock (from updating contact A) and then wants
  // contact B. A standalone update of contact B already holds B and waits for
  // the user lock. Postgres aborts one of them; both must still succeed.
  it('retries the deadlock victim so both writes land', async () => {
    const aWrote = deferred();
    const go = deferred();
    const txA = withDeadlockRetry(() => prisma.$transaction(async (tx) => {
      await tx.person.update({ where: { id: a.id }, data: { name: 'A1' } });
      aWrote.resolve();
      await go.promise;
      await tx.person.update({ where: { id: b.id }, data: { notes: 'from A' } });
    }, { timeout: 15000 }));
    await aWrote.promise;
    // Prisma queries are lazy; .then starts this one now.
    const single = prisma.person.update({ where: { id: b.id }, data: { name: 'B1' } }).then(() => undefined);
    await waitForLockWait('%UPDATE%people%');
    go.resolve();

    const results = await Promise.allSettled([txA, single]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const rowB = await testPrisma.person.findUniqueOrThrow({ where: { id: b.id } });
    expect(rowB).toMatchObject({ name: 'B1', notes: 'from A' });
    expect((await testPrisma.person.findUniqueOrThrow({ where: { id: a.id } })).name).toBe('A1');
  });

  // Two multi-contact transactions that lock the user row first queue behind
  // each other instead of deadlocking, with no retry needed.
  it('serializes multi-contact transactions that take the user lock first', async () => {
    const firstWrote = deferred();
    const go = deferred();
    const first = testPrisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      await tx.person.update({ where: { id: a.id }, data: { name: 'A1' } });
      firstWrote.resolve();
      await go.promise;
      await tx.person.update({ where: { id: b.id }, data: { notes: 'first' } });
    }, { timeout: 15000 });
    await firstWrote.promise;
    const second = testPrisma.$transaction(async (tx) => {
      await lockUserRow(tx, userId);
      await tx.person.update({ where: { id: b.id }, data: { name: 'B2' } });
      await tx.person.update({ where: { id: a.id }, data: { notes: 'second' } });
    }, { timeout: 15000 });
    // Any lock wait: the second transaction is queued behind the first.
    await waitForLockWait('%');
    go.resolve();

    const results = await Promise.allSettled([first, second]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
  });
});
