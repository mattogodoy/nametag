import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/relationships/[id]/restore - Restore a soft-deleted relationship
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Ownership lives on the relationship's person, so it goes in the lookup:
    // another user's relationship reads as missing rather than forbidden.
    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.relationship.findFirst({
          where: { id, person: { userId: session.user.id } },
        }),
      {
        notFound: 'Relationship not found',
        notDeleted: 'Relationship is not deleted',
      }
    );
    if (!guard.ok) return guard.response;

    const relationship = guard.record;

    const restored = await prismaIncludingDeleted.relationship.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Also restore the inverse relationship if it exists and was deleted too
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
