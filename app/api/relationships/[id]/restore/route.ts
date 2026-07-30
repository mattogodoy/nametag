import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// POST /api/relationships/[id]/restore - Restore a soft-deleted relationship
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Find the soft-deleted relationship (using raw client to bypass soft-delete filter)
    const relationship = await prismaIncludingDeleted.relationship.findUnique({
      where: { id },
      include: {
        person: true,
      },
    });

    if (!relationship) {
      return apiResponse.notFound('Relationship not found');
    }

    // Verify the person belongs to the user
    if (relationship.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    if (!relationship.deletedAt) {
      return apiResponse.error('Relationship is not deleted');
    }

    // Restore the relationship by clearing deletedAt
    const restored = await prismaIncludingDeleted.relationship.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Also restore the inverse relationship if it exists and was deleted at the same time
    const inverse = await prismaIncludingDeleted.relationship.findFirst({
      where: {
        personId: relationship.relatedPersonId,
        relatedPersonId: relationship.personId,
        deletedAt: { not: null },
      },
    });

    if (inverse) {
      await prismaIncludingDeleted.relationship.update({
        where: { id: inverse.id },
        data: { deletedAt: null },
      });
    }

    return apiResponse.ok({ relationship: restored });
  } catch (error) {
    return handleApiError(error, 'relationships-restore');
  }
});
