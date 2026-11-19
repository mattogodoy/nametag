import { Prisma, type PrismaClient } from '@prisma/client';
import { multiValueFieldsInclude } from '@/lib/prisma-queries';

// Delta sync reads deliberately include soft-deleted rows (deletedAt set), so
// clients can move them to a local trash. Callers pass prismaIncludingDeleted.

export type SyncEntityType =
  | 'person' | 'group' | 'relationship' | 'importantDate'
  | 'relationshipType' | 'journalEntry' | 'customFieldTemplate';

export type SyncRecord = Record<string, unknown>;

export interface SyncPage {
  cursor: string;
  hasMore: boolean;
  changes: {
    people: SyncRecord[]; groups: SyncRecord[]; relationships: SyncRecord[];
    importantDates: SyncRecord[]; relationshipTypes: SyncRecord[];
    journalEntries: SyncRecord[]; customFieldTemplates: SyncRecord[];
  };
  deleted: Array<{ type: SyncEntityType; id: string }>;
}

type ChangeKey = keyof SyncPage['changes'];

interface Entry {
  version: bigint;
  key: ChangeKey | 'deleted';
  row: SyncRecord;
}

/** Recursively turns bigint values into strings. */
function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  if (typeof (value as { toJSON?: unknown }).toJSON === 'function') return value; // Decimal
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
}

function toEntries<T extends { syncVersion: bigint }>(
  key: ChangeKey, rows: T[], shape: (row: T) => SyncRecord = (r) => r as unknown as SyncRecord
): Entry[] {
  return rows.map((r) => ({ version: r.syncVersion, key, row: jsonSafe(shape(r)) as SyncRecord }));
}

/**
 * Outcome of a delta read. 'ahead' means the cursor is beyond this server's
 * syncSeq, 'expired' means tombstones the cursor needs may have been purged,
 * and 'no_user' means the user row is gone.
 */
export type SyncResult =
  | { status: 'ok'; page: SyncPage }
  | { status: 'expired' }
  | { status: 'ahead' }
  | { status: 'no_user' };

/**
 * A parsed cursor. Incremental cursors are a plain sequence number. A full
 * sync (one that started from 0) that is still below the tombstone floor
 * carries the floor it started under as `seq:floor`: such a client cannot
 * hold anything whose tombstone was purged before it started, so the cursor
 * stays valid until the floor moves again. Without this, every page of a full
 * sync below the floor would be refused and the client would restart from 0
 * forever.
 */
export interface SyncCursor {
  seq: bigint;
  fullSyncFloor: bigint | null;
}

const CURSOR = /^(\d{1,19})(?::(\d{1,19}))?$/;

/** Parses `N` or `N:F`; null when malformed. */
export function parseSyncCursor(raw: string): SyncCursor | null {
  const m = CURSOR.exec(raw);
  if (!m) return null;
  return { seq: BigInt(m[1]), fullSyncFloor: m[2] === undefined ? null : BigInt(m[2]) };
}

export async function getChangesSince(
  client: PrismaClient, userId: string, cursorIn: bigint | SyncCursor, limit: number
): Promise<SyncResult> {
  const parsed: SyncCursor = typeof cursorIn === 'bigint' ? { seq: cursorIn, fullSyncFloor: null } : cursorIn;
  const cursor = parsed.seq;
  const take = limit + 1;
  const after = { gt: cursor };
  const order = { syncVersion: 'asc' as const };
  // The app clients omit syncVersion globally (BigInt breaks JSON), so every
  // query here opts back in or rows would carry no version to page by.
  const omit = { syncVersion: false } as const;
  const byUser = { userId, syncVersion: after };
  const byPerson = { person: { userId }, syncVersion: after };

  // All reads share one REPEATABLE READ snapshot. Versions are handed out under
  // the user-row lock, so they commit in version order: a single snapshot that
  // holds version v also holds every lower version. Separate snapshots (one per
  // pooled connection) break that. People could be read before a commit and
  // groups after it, returning a later group version while an earlier person
  // version is skipped for good once the cursor moves past it. The queries run
  // one after another because a transaction client serves one query at a time.
  //
  // The cursor checks read syncSeq and syncTombstoneFloor inside that same
  // snapshot, as its first query. If they were read before the transaction, the
  // tombstone purge cron could commit in between: it raises the floor above the
  // cursor and deletes tombstones at or below it, and this read would then miss
  // those deletions for good while still answering 200. Read in the snapshot,
  // the floor and the tombstones are always consistent with each other.
  const read = await client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { syncSeq: true, syncTombstoneFloor: true },
    });
    if (!user) return { status: 'no_user' as const };
    if (cursor > user.syncSeq) return { status: 'ahead' as const };
    const floor = user.syncTombstoneFloor;
    // Cursor 0 starts a full sync and is always valid. A full-sync cursor is
    // valid while no purge has run since the sync started; a plain cursor
    // must not be below the floor.
    let fullSyncFloor: bigint | null = null;
    if (cursor === BigInt(0) && parsed.fullSyncFloor === null) fullSyncFloor = floor;
    else if (parsed.fullSyncFloor !== null) {
      if (parsed.fullSyncFloor !== floor) return { status: 'expired' as const };
      fullSyncFloor = floor;
    } else if (cursor < floor) return { status: 'expired' as const };

    const people = await tx.person.findMany({
      where: byUser, orderBy: order, take, omit,
      include: {
        ...multiValueFieldsInclude(),
        // Unfiltered: values on a trashed template must still sync, since
        // restoring the template does not bump the person. Templates sync
        // as their own table.
        customFieldValues: true,
        groups: { select: { groupId: true } },
      },
    });
    const groups = await tx.group.findMany({ where: byUser, orderBy: order, take, omit });
    const relationships = await tx.relationship.findMany({ where: byPerson, orderBy: order, take, omit });
    const importantDates = await tx.importantDate.findMany({ where: byPerson, orderBy: order, take, omit });
    const relationshipTypes = await tx.relationshipType.findMany({ where: byUser, orderBy: order, take, omit });
    const journalEntries = await tx.journalEntry.findMany({
      where: byUser, orderBy: order, take, omit,
      include: { people: { select: { personId: true } } },
    });
    const templates = await tx.customFieldTemplate.findMany({ where: byUser, orderBy: order, take, omit });
    const stones = await tx.syncTombstone.findMany({ where: byUser, orderBy: order, take });
    return { status: 'ok' as const, fullSyncFloor, syncSeq: user.syncSeq, people, groups, relationships, importantDates, relationshipTypes, journalEntries, templates, stones };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  if (read.status !== 'ok') return { status: read.status };
  const { fullSyncFloor, syncSeq, people, groups, relationships, importantDates, relationshipTypes, journalEntries, templates, stones } = read;

  const all: Entry[] = [
    ...toEntries('people', people, ({ groups: g, ...rest }) => ({ ...rest, groupIds: g.map((x) => x.groupId) })),
    ...toEntries('groups', groups),
    ...toEntries('relationships', relationships),
    ...toEntries('importantDates', importantDates),
    ...toEntries('relationshipTypes', relationshipTypes),
    ...toEntries('journalEntries', journalEntries, ({ people: p, ...rest }) => ({ ...rest, personIds: p.map((x) => x.personId) })),
    ...toEntries('customFieldTemplates', templates),
    ...stones.map((s): Entry => ({
      version: s.syncVersion, key: 'deleted', row: { type: s.entityType, id: s.entityId },
    })),
  // Versions come from one per-user counter, so they are unique: no ties to split.
  ].sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));

  const kept = all.slice(0, limit);
  const hasMore = all.length > limit;
  let next = kept.length > 0 ? kept[kept.length - 1].version : cursor;
  // A finished full sync has read every version up to syncSeq in this
  // snapshot, so it can hand back syncSeq, which is never below the floor.
  // Otherwise its last page could stay below the floor (the gap being purged
  // tombstones) and expire on the next purge for no reason.
  if (fullSyncFloor !== null && !hasMore) next = syncSeq;
  const page: SyncPage = {
    cursor: fullSyncFloor !== null && next < fullSyncFloor ? `${next}:${fullSyncFloor}` : next.toString(),
    hasMore,
    changes: {
      people: [], groups: [], relationships: [], importantDates: [],
      relationshipTypes: [], journalEntries: [], customFieldTemplates: [],
    },
    deleted: [],
  };
  for (const e of kept) {
    if (e.key === 'deleted') page.deleted.push(e.row as { type: SyncEntityType; id: string });
    else page.changes[e.key].push(e.row);
  }
  return { status: 'ok', page };
}
