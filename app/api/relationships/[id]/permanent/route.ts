import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// DELETE /api/relationships/[id]/permanent - Permanently delete a trashed relationship
export const DELETE = withAuth(async (_request, session, context) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { id } = await context.params;

    const relationship = await prismaWithDeleted.relationship.findUnique({
      where: { id },
      include: { person: true },
    });

    if (!relationship) {
      return apiResponse.notFound('Relationship not found');
    }

    if (relationship.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    if (!relationship.deletedAt) {
      return apiResponse.error('Relationship is not deleted');
    }

    // Delete the inverse relationship if it's also trashed
    const inverse = await prismaWithDeleted.relationship.findFirst({
      where: {
        personId: relationship.relatedPersonId,
        relatedPersonId: relationship.personId,
        deletedAt: { not: null },
      },
    });

    if (inverse) {
      await prismaWithDeleted.relationship.delete({ where: { id: inverse.id } });
    }

    await prismaWithDeleted.relationship.delete({ where: { id } });

    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'relationships-permanent-delete');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
