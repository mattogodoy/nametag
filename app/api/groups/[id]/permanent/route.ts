import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/groups/[id]/permanent - Permanently delete a trashed group
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const group = await prismaIncludingDeleted.group.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!group) {
      return apiResponse.notFound('Group not found');
    }

    if (!group.deletedAt) {
      return apiResponse.error('Group is not deleted');
    }

    // Delete memberships first
    await prismaIncludingDeleted.personGroup.deleteMany({ where: { groupId: id } });

    // Delete the group
    await prismaIncludingDeleted.group.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'groups-permanent-delete');
  }
});
