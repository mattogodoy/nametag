import { prisma } from '@/lib/prisma';
import { autoUpdatePerson } from './auto-export';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

export async function batchSyncPersonsToCardDav(
  userId: string,
  personIds: string[],
  context?: { groupId?: string },
): Promise<void> {
  const connection = await prisma.cardDavConnection.findUnique({
    where: { userId },
  });

  if (!connection || !connection.syncEnabled) {
    return;
  }

  if (personIds.length === 0) {
    return;
  }

  const syncEnabledPersons = await prisma.person.findMany({
    where: {
      id: { in: personIds },
      userId,
      deletedAt: null,
      cardDavSyncEnabled: true,
    },
    select: { id: true },
  });

  if (syncEnabledPersons.length === 0) {
    return;
  }

  for (let i = 0; i < syncEnabledPersons.length; i += BATCH_SIZE) {
    const batch = syncEnabledPersons.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((person) => autoUpdatePerson(person.id)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'rejected') {
        const error: unknown = result.reason;
        log.error(
          {
            event: 'carddav.groupSync.personFailed',
            personId: batch[j].id,
            groupId: context?.groupId,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          'Failed to sync person after group change',
        );
      }
    }

    if (i + BATCH_SIZE < syncEnabledPersons.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  log.info(
    { groupId: context?.groupId, count: syncEnabledPersons.length },
    'Triggered CardDAV sync for group members',
  );
}

export async function syncGroupMembersToCardDav(
  groupId: string,
  userId: string,
  personIds?: string[],
): Promise<void> {
  const ids =
    personIds ??
    (
      await prisma.personGroup.findMany({
        where: { groupId },
        select: { personId: true },
      })
    ).map((pg) => pg.personId);

  await batchSyncPersonsToCardDav(userId, ids, { groupId });
}
