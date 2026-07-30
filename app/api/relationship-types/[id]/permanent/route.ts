import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/relationship-types/[id]/permanent - Permanently delete a trashed relationship type
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const relationshipType = await prismaIncludingDeleted.relationshipType.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    if (!relationshipType.deletedAt) {
      return apiResponse.error('Relationship type is not deleted');
    }

    // Clear references before deleting
    await prismaIncludingDeleted.person.updateMany({
      where: { relationshipToUserId: id },
      data: { relationshipToUserId: null },
    });
    await prismaIncludingDeleted.relationship.updateMany({
      where: { relationshipTypeId: id },
      data: { relationshipTypeId: null },
    });
    await prismaIncludingDeleted.relationshipType.updateMany({
      where: { inverseId: id },
      data: { inverseId: null },
    });

    await prismaIncludingDeleted.relationshipType.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'relationship-types-permanent-delete');
  }
});
