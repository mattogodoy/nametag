import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// DELETE /api/groups/[id]/permanent - Permanently delete a trashed group
export const DELETE = withAuth(async (_request, session, context) => {
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

    // Delete memberships first
    await prismaIncludingDeleted.personGroup.deleteMany({ where: { groupId: id } });

    // Delete the group
    await prismaIncludingDeleted.group.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'groups-permanent-delete');
  }
});
