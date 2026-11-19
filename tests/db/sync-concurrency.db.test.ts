import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import { testPrisma, createUser, resetDb } from './client';
import { type SyncPage } from '@/lib/sync/changes';
import { getPage } from './sync-helpers';

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
    await (await import('@/lib/prisma')).prismaIncludingDeleted.$disconnect();
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

  /** Polls until another backend is waiting on a lock while running a matching query. */
  async function waitForLockWait(pattern: string): Promise<number> {
    let waiting = 0;
    for (let i = 0; i < 100 && waiting < 1; i++) {
      const rows = await testPrisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
          AND datname = current_database()
          AND pid <> pg_backend_pid()
          AND query ILIKE ${pattern}`;
      waiting = rows[0]?.n ?? 0;
      if (waiting < 1) await new Promise((r) => setTimeout(r, 50));
    }
    if (waiting < 1) {
      // Diagnostics for a timed-out poll: what every other backend is doing.
      const all = await testPrisma.$queryRaw<Record<string, unknown>[]>`
        SELECT pid, state, wait_event_type, wait_event, left(query, 200) AS query
        FROM pg_stat_activity
        WHERE datname = current_database() AND pid <> pg_backend_pid()`;
      console.error(`no lock wait matching ${pattern}`, JSON.stringify(all, null, 2));
    }
    return waiting;
  }

  it('a reader on one snapshot never skips a version committed mid-read', async () => {
    // Shape: person write P takes version A and stays open. Group write G waits
    // on the user lock and will get A+1. A table lock parks the reader's groups
    // query. P and G commit while it is parked, then the reader resumes. With
    // one snapshot the reader sees neither. With a fresh snapshot per query
    // (the old Promise.all on pooled connections) it misses P, which was read
    // before the commit, but sees G, so its cursor jumps past A for good.
    const { prismaIncludingDeleted } = await import('@/lib/prisma');
    const person = await testPrisma.person.create({ data: { userId, name: 'A' } });
    const start = person.syncVersion;

    const releaseP = deferred();
    const pWrote = deferred();
    const releaseX = deferred();
    const xLocked = deferred();

    const p = testPrisma.$transaction(async (tx) => {
      await tx.person.update({ where: { id: person.id }, data: { name: 'A1' } });
      pWrote.resolve();
      await releaseP.promise;
    }, { timeout: 15000 });

    let g: Promise<{ id: string }> | undefined;
    let x: Promise<void> | undefined;
    let first: Promise<SyncPage> | undefined;
    try {
      await pWrote.promise;
      // G holds ROW EXCLUSIVE on groups while it waits for the user row.
      // Prisma queries are lazy thenables: .then() is what sends the INSERT.
      g = testPrisma.group.create({ data: { userId, name: 'G' } }).then((row) => row);
      expect(await waitForLockWait('%INSERT INTO "public"."groups"%')).toBeGreaterThanOrEqual(1);

      // X queues for ACCESS EXCLUSIVE behind G, so later groups reads queue behind X.
      x = testPrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('LOCK TABLE "groups" IN ACCESS EXCLUSIVE MODE');
        xLocked.resolve();
        await releaseX.promise;
      }, { timeout: 15000, maxWait: 15000 });
      expect(await waitForLockWait('%LOCK TABLE%groups%')).toBeGreaterThanOrEqual(1);

      first = getPage(prismaIncludingDeleted, userId, start, 500);
      expect(await waitForLockWait('%SELECT%FROM "public"."groups"%')).toBeGreaterThanOrEqual(1);
      // Let every reader query that is not parked finish against the old state.
      await new Promise((r) => setTimeout(r, 300));

      releaseP.resolve();
      await p;
      const group = await g;
      await xLocked.promise;
      releaseX.resolve();
      await x;

      const page1 = await first;
      expect(page1.changes.groups.map((r) => r.id)).not.toContain(group.id);

      const seen = Object.values(page1.changes).flat().map((r) => String(r.id));
      let cursor = BigInt(page1.cursor);
      for (let i = 0; i < 10; i++) {
        const page = await getPage(prismaIncludingDeleted, userId, cursor, 1);
        seen.push(...Object.values(page.changes).flat().map((r) => String(r.id)));
        cursor = BigInt(page.cursor);
        if (!page.hasMore) break;
      }
      expect(seen.filter((id) => id === person.id)).toHaveLength(1);
      expect(seen.filter((id) => id === group.id)).toHaveLength(1);
    } finally {
      releaseP.resolve();
      releaseX.resolve();
      await Promise.allSettled([p, g ?? Promise.resolve(), x ?? Promise.resolve(), first ?? Promise.resolve()]);
    }
  });
});
