import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { findAllDuplicateGroups } from '@/lib/duplicate-detection';

// GET /api/people/duplicates - Find all duplicate groups
export const GET = withAuth(async (_request, session) => {
  try {
    const allPeople = await prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, surname: true },
    });

    const groups = findAllDuplicateGroups(allPeople);

    return apiResponse.ok({ groups });
  } catch (error) {
    return handleApiError(error, 'people-duplicates-all');
  }
});
