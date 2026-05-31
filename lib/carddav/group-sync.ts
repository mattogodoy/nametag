import { prisma } from '@/lib/prisma';
import { autoUpdatePerson } from './auto-export';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

/**
 * Trigger CardDAV sync for all members of a group.
 * Called when a group is renamed or deleted so that each member's
 * vCard CATEGORIES field is updated on the server.
 *
 * @param groupId - The group that changed
 * @param userId - Owner of the group (for authorization)
 * @param personIds - Optional pre-fetched list of person IDs to sync
 */
export async function syncGroupMembersToCardDav(
  groupId: string,
  userId: string,
  personIds?: string[],
): Promise<void> {
  const connection = await prisma.cardDavConnection.findUnique({
    where: { userId },
  });

  if (!connection || !connection.syncEnabled) {
    return;
  }

  const ids =
    personIds ??
    (
      await prisma.personGroup.findMany({
        where: { groupId },
        select: { personId: true },
      })
    ).map((pg) => pg.personId);

  if (ids.length === 0) {
    return;
  }

  const syncEnabledPersons = await prisma.person.findMany({
    where: {
      id: { in: ids },
      userId,
      deletedAt: null,
      cardDavSyncEnabled: true,
    },
    select: { id: true },
  });

  const batchSize = 10;
  for (let i = 0; i < syncEnabledPersons.length; i += batchSize) {
    const batch = syncEnabledPersons.slice(i, i + batchSize);

    for (const person of batch) {
      try {
        await autoUpdatePerson(person.id);
      } catch (error: unknown) {
        log.error(
          {
            event: 'carddav.groupSync.personFailed',
            personId: person.id,
            groupId,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          'Failed to sync person after group change',
        );
      }
    }

    if (i + batchSize < syncEnabledPersons.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  log.info(
    { groupId, count: syncEnabledPersons.length },
    'Triggered CardDAV sync for group members',
  );
}
