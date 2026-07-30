import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/people/[id]/important-dates/[dateId]/permanent - Permanently delete a trashed important date
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, dateId } = await context.params;

    const person = await prismaIncludingDeleted.person.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    const importantDate = await prismaIncludingDeleted.importantDate.findUnique({
      where: { id: dateId, personId: id },
    });

    if (!importantDate) {
      return apiResponse.notFound('Important date not found');
    }

    if (!importantDate.deletedAt) {
      return apiResponse.error('Important date is not deleted');
    }

    await prismaIncludingDeleted.importantDate.delete({ where: { id: dateId } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'important-dates-permanent-delete');
  }
});
