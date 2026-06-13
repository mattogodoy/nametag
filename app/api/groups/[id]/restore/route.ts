import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { syncGroupMembersToCardDav } from '@/lib/carddav/group-sync';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('groups');

// POST /api/groups/[id]/restore - Restore a soft-deleted group
export const POST = withAuth(async (_request, session, context) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { id } = await context.params;

    // Find the soft-deleted group (using raw client to bypass soft-delete filter)
    const group = await prismaWithDeleted.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!group) {
      return apiResponse.notFound('Group not found');
    }

    if (!group.deletedAt) {
      return apiResponse.error('Group is not deleted');
    }

    // Restore the group by clearing deletedAt
    const restored = await prismaWithDeleted.group.update({
      where: { id },
      data: { deletedAt: null },
    });

    syncGroupMembersToCardDav(id, session.user.id).catch((error) => {
      log.error({ err: error instanceof Error ? error : new Error(String(error)), groupId: id },
        'CardDAV sync after group restore failed');
    });

    return apiResponse.ok({ group: restored });
  } catch (error) {
    return handleApiError(error, 'groups-restore');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
