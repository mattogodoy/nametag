import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/groups/[id]/members/[personId] - Remove a member from a group
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, personId } = await context!.params;

    // Verify group belongs to user
    const group = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
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

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'groups-remove-member');
  }
});
