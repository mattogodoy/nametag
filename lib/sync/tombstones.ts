import type { PrismaClient } from '@prisma/client';

/**
 * Deletes tombstones older than `olderThan` and raises each affected user's
 * syncTombstoneFloor, so a cursor that could have missed them is rejected.
 * The floor is updated in the same transaction as the delete.
 *
 * Deleting by `syncVersion <= max` also removes any newer-dated tombstone with
 * a lower version, which is safe because the floor covers it.
 */
export async function purgeTombstones(client: PrismaClient, olderThan: Date): Promise<number> {
  const groups = await client.syncTombstone.groupBy({
    by: ['userId'],
    where: { deletedAt: { lt: olderThan } },
    _max: { syncVersion: true },
  });
  let total = 0;
  for (const g of groups) {
    const max = g._max.syncVersion;
    if (max === null) continue;
    const [deleted] = await client.$transaction([
      client.syncTombstone.deleteMany({ where: { userId: g.userId, syncVersion: { lte: max } } }),
      client.user.updateMany({
        where: { id: g.userId, syncTombstoneFloor: { lt: max } },
        data: { syncTombstoneFloor: max },
      }),
    ]);
    total += deleted.count;
  }
  return total;
}
