import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/relationship-types/[id]/restore - Restore a soft-deleted relationship type
export const POST = withAuth(async (_request, session, context) => {
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

    const restored = await prismaIncludingDeleted.relationshipType.update({
      where: { id },
      data: { deletedAt: null },
    });

    return apiResponse.ok({ relationshipType: restored });
  } catch (error) {
    return handleApiError(error, 'relationship-types-restore');
  }
});
