import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// POST /api/relationship-types/[id]/restore - Restore a soft-deleted relationship type
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Find the soft-deleted relationship type (using raw client to bypass soft-delete filter)
    const relationshipType = await prismaIncludingDeleted.relationshipType.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    if (!relationshipType.deletedAt) {
      return apiResponse.error('Relationship type is not deleted');
    }

    // Restore the relationship type by clearing deletedAt
    const restored = await prismaIncludingDeleted.relationshipType.update({
      where: { id },
      data: { deletedAt: null },
    });

    return apiResponse.ok({ relationshipType: restored });
  } catch (error) {
    return handleApiError(error, 'relationship-types-restore');
  }
});
