import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/people/[id]/important-dates/[dateId]/permanent - Permanently delete a trashed important date
export const DELETE = withAuth(async (_request, session, context) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { id, dateId } = await context.params;

    const person = await prismaWithDeleted.person.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    const importantDate = await prismaWithDeleted.importantDate.findUnique({
      where: { id: dateId, personId: id },
    });

    if (!importantDate) {
      return apiResponse.notFound('Important date not found');
    }

    if (!importantDate.deletedAt) {
      return apiResponse.error('Important date is not deleted');
    }

    await prismaWithDeleted.importantDate.delete({ where: { id: dateId } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'important-dates-permanent-delete');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
