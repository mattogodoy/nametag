import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import {
  findAllDuplicateGroups,
  mapPersonForComparison,
  PERSON_SELECT_FOR_COMPARISON,
} from '@/lib/duplicate-detection';

// GET /api/people/duplicates - Find all duplicate groups
export const GET = withAuth(async (_request, session) => {
  try {
    const [allPeople, dismissals] = await Promise.all([
      prisma.person.findMany({
        where: { userId: session.user.id, deletedAt: null },
        select: PERSON_SELECT_FOR_COMPARISON,
      }),
      prisma.duplicateDismissal.findMany({
        where: { userId: session.user.id },
        select: { personAId: true, personBId: true },
      }),
    ]);

    const dismissedPairs = new Set(
      dismissals.map((d) => `${d.personAId}:${d.personBId}`)
    );

    const mapped = allPeople.map(mapPersonForComparison);
    const groups = findAllDuplicateGroups(mapped, dismissedPairs);

    return apiResponse.ok({ groups });
  } catch (error) {
    return handleApiError(error, 'people-duplicates-all');
  }
});
