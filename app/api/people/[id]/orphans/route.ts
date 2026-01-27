import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// GET /api/people/[id]/orphans - Check which people would become orphans if this person is deleted
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // Fetch the person and all their relationships in one query
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        relationshipsFrom: {
          where: { deletedAt: null },
        },
        relationshipsTo: {
          where: { deletedAt: null },
        },
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Get unique person IDs related to this person
    const relatedPersonIds = new Set<string>();
    person.relationshipsFrom.forEach((rel) => {
      if (rel.relatedPersonId) relatedPersonIds.add(rel.relatedPersonId);
    });
    person.relationshipsTo.forEach((rel) => {
      if (rel.personId) relatedPersonIds.add(rel.personId);
    });

    if (relatedPersonIds.size === 0) {
      return apiResponse.ok({ orphans: [] });
    }

    // Fetch all related people and their own relationships in bulk
    const relatedPeople = await prisma.person.findMany({
      where: {
        id: { in: Array.from(relatedPersonIds) },
        userId: session.user.id,
      },
      include: {
        relationshipToUser: true,
        relationshipsFrom: {
          where: { deletedAt: null },
        },
        relationshipsTo: {
          where: { deletedAt: null },
        },
      },
    });

    // A person becomes an orphan if:
    // 1. They have no direct relationship to the user (or it's soft-deleted)
    // 2. After deleting this person, they would have no other relationships
    const potentialOrphans = relatedPeople
      .filter((p) => {
        // Condition 1: No direct relationship to user
        if (p.relationshipToUser) return false;

        // Condition 2: No other relationships besides the ones with the person being deleted
        const otherRelationships = [
          ...p.relationshipsFrom.filter((r) => r.relatedPersonId !== id),
          ...p.relationshipsTo.filter((r) => r.personId !== id),
        ];

        return otherRelationships.length === 0;
      })
      .map((p) => ({
        id: p.id,
        fullName: formatFullName(p),
      }));

    return apiResponse.ok({ orphans: potentialOrphans });
  } catch (error) {
    return handleApiError(error, 'people-orphans');
  }
});
