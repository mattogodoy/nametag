import type { PrismaClient } from '@prisma/client';
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

export async function getChangesSince(
  client: PrismaClient, userId: string, cursor: bigint, limit: number
): Promise<SyncPage> {
  const take = limit + 1;
  const after = { gt: cursor };
  const order = { syncVersion: 'asc' as const };
  // The app clients omit syncVersion globally (BigInt breaks JSON), so every
  // query here opts back in or rows would carry no version to page by.
  const omit = { syncVersion: false } as const;
  const byUser = { userId, syncVersion: after };
  const byPerson = { person: { userId }, syncVersion: after };

  const [people, groups, relationships, importantDates, relationshipTypes, journalEntries, templates, stones] =
    await Promise.all([
      client.person.findMany({
        where: byUser, orderBy: order, take, omit,
        include: { ...multiValueFieldsInclude(), groups: { select: { groupId: true } } },
      }),
      client.group.findMany({ where: byUser, orderBy: order, take, omit }),
      client.relationship.findMany({ where: byPerson, orderBy: order, take, omit }),
      client.importantDate.findMany({ where: byPerson, orderBy: order, take, omit }),
      client.relationshipType.findMany({ where: byUser, orderBy: order, take, omit }),
      client.journalEntry.findMany({
        where: byUser, orderBy: order, take, omit,
        include: { people: { select: { personId: true } } },
      }),
      client.customFieldTemplate.findMany({ where: byUser, orderBy: order, take, omit }),
      client.syncTombstone.findMany({ where: byUser, orderBy: order, take }),
    ]);

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
  ].sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));

  const kept = all.slice(0, limit);
  const page: SyncPage = {
    cursor: (kept.length > 0 ? kept[kept.length - 1].version : cursor).toString(),
    hasMore: all.length > limit,
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
  return page;
}
