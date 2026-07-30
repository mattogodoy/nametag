import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// POST /api/people/[id]/important-dates/[dateId]/restore - Restore a soft-deleted important date
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id, dateId } = await context.params;

    // Check if person exists and belongs to user
    const person = await prismaIncludingDeleted.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Find the soft-deleted important date (using raw client to bypass soft-delete filter)
    const importantDate = await prismaIncludingDeleted.importantDate.findUnique({
      where: {
        id: dateId,
        personId: id,
      },
    });

    if (!importantDate) {
      return apiResponse.notFound('Important date not found');
    }

    if (!importantDate.deletedAt) {
      return apiResponse.error('Important date is not deleted');
    }

    // Check for uniqueness conflict with predefined types
    if (importantDate.type) {
      const existing = await prismaIncludingDeleted.importantDate.findFirst({
        where: {
          personId: id,
          type: importantDate.type,
          deletedAt: null,
        },
      });
      if (existing) {
        return apiResponse.error(
          `A ${importantDate.type} date already exists for this person. Delete it first before restoring this one.`
        );
      }
    }

    // Restore the important date by clearing deletedAt
    const restored = await prismaIncludingDeleted.importantDate.update({
      where: { id: dateId },
      data: { deletedAt: null },
    });

    return apiResponse.ok({ importantDate: restored });
  } catch (error) {
    return handleApiError(error, 'important-date-restore');
  }
});
