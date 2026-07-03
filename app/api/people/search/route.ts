import { prisma } from '@/lib/prisma';
import { apiResponse, withAuth } from '@/lib/api-utils';
import { filterPeople } from '@/lib/search';

export const GET = withAuth(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (query.length === 0) {
    return apiResponse.ok({ people: [] });
  }

  // Fetch all people and filter in JS for accent-insensitive search.
  // This keeps the app database-agnostic (no dependency on PostgreSQL extensions).
  const allPeople = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      surname: true,
      middleName: true,
      secondLastName: true,
      nickname: true,
      displayNameOverride: true,
      photo: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  const people = filterPeople(
    allPeople,
    query,
    ['name', 'surname', 'middleName', 'secondLastName', 'nickname', 'displayNameOverride']
  ).slice(0, 20);

  return apiResponse.ok({ people });
});
