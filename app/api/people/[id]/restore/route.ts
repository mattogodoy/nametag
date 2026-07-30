import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

// POST /api/people/[id]/restore - Restore a soft-deleted person
export const POST = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const guard = await requireTrashedRecord(
      () =>
        prismaIncludingDeleted.person.findFirst({
          where: { id, userId: session.user.id },
        }),
      { notFound: 'Person not found', notDeleted: 'Person is not deleted' }
    );
    if (!guard.ok) return guard.response;

    const restored = await prismaIncludingDeleted.person.update({
      where: { id },
      data: { deletedAt: null },
    });

    return apiResponse.ok({ person: restored });
  } catch (error) {
    return handleApiError(error, 'people-restore');
  }
});
