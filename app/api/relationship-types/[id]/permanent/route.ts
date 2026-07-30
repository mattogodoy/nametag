import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// DELETE /api/relationship-types/[id]/permanent - Permanently delete a trashed relationship type
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.relationshipType.findFirst({
          where: { id, userId: session.user.id },
        }),
      {
        notFound: 'Relationship type not found',
        notDeleted: 'Relationship type is not deleted',
      }
    );
    if (!guard.ok) return guard.response;

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
