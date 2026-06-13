import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { autoUpdatePerson } from '@/lib/carddav/auto-export';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('groups');

// DELETE /api/groups/[id]/members/[personId] - Remove a member from a group
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, personId } = await context.params;

    // Verify group belongs to user
    const group = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!group) {
      return apiResponse.notFound('Group not found');
    }

    // Remove person from group
    const deleted = await prisma.personGroup.deleteMany({
      where: {
        personId,
        groupId: id,
      },
    });

    if (deleted.count === 0) {
      return apiResponse.notFound('Person is not a member of this group');
    }

    const person = await prisma.person.findUnique({
      where: { id: personId, userId: session.user.id, deletedAt: null },
      select: { cardDavSyncEnabled: true },
    });

    if (person?.cardDavSyncEnabled) {
      autoUpdatePerson(personId).catch((error) => {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), personId },
          'CardDAV auto-update after group member removal failed');
      });
    }

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'groups-remove-member');
  }
});
