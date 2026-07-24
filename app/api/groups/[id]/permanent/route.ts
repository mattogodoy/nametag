import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/groups/[id]/permanent - Permanently delete a trashed group
export const DELETE = withAuth(async (_request, session, context) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { id } = await context.params;

    const group = await prismaWithDeleted.group.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!group) {
      return apiResponse.notFound('Group not found');
    }

    if (!group.deletedAt) {
      return apiResponse.error('Group is not deleted');
    }

    // Delete memberships first
    await prismaWithDeleted.personGroup.deleteMany({ where: { groupId: id } });

    // Delete the group
    await prismaWithDeleted.group.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'groups-permanent-delete');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
