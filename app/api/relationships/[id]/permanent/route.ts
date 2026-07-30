import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// DELETE /api/relationships/[id]/permanent - Permanently delete a trashed relationship
export const DELETE = withAuth(async (_request, session, context) => {
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

    // Delete the inverse relationship if it's also trashed
    const inverse = await prismaIncludingDeleted.relationship.findFirst({
      where: {
        personId: relationship.relatedPersonId,
        relatedPersonId: relationship.personId,
        deletedAt: { not: null },
      },
    });

    if (inverse) {
      await prismaIncludingDeleted.relationship.delete({ where: { id: inverse.id } });
    }

    await prismaIncludingDeleted.relationship.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'relationships-permanent-delete');
  }
});
