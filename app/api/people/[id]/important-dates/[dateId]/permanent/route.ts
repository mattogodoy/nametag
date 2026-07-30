import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// DELETE /api/people/[id]/important-dates/[dateId]/permanent - Permanently delete a trashed important date
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, dateId } = await context.params;

    // Ownership is expressed through the parent person, so a date belonging to
    // another user's person reads as missing rather than forbidden.
    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.importantDate.findFirst({
          where: { id: dateId, personId: id, person: { userId: session.user.id } },
        }),
      {
        notFound: 'Important date not found',
        notDeleted: 'Important date is not deleted',
      }
    );
    if (!guard.ok) return guard.response;

    await prismaIncludingDeleted.importantDate.delete({ where: { id: dateId } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'important-dates-permanent-delete');
  }
});
