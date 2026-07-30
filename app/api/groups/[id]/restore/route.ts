import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';
import { syncGroupMembersToCardDav } from '@/lib/carddav/group-sync';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('groups');

// POST /api/groups/[id]/restore - Restore a soft-deleted group
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.group.findFirst({
          where: { id, userId: session.user.id },
        }),
      { notFound: 'Group not found', notDeleted: 'Group is not deleted' }
    );
    if (!guard.ok) return guard.response;

    const restored = await prismaIncludingDeleted.group.update({
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
  }
});
