import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/people/[id]/important-dates/[dateId]/restore - Restore a soft-deleted important date
export const POST = withAuth(async (_request, session, context) => {
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

    const importantDate = guard.record;

    // A person may hold only one date of each predefined type, so restoring
    // would collide with whatever currently occupies that slot.
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

    const restored = await prismaIncludingDeleted.importantDate.update({
      where: { id: dateId },
      data: { deletedAt: null },
    });

    return apiResponse.ok({ importantDate: restored });
  } catch (error) {
    return handleApiError(error, 'important-date-restore');
  }
});
