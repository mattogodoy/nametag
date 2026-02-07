import { prisma } from '@/lib/prisma';
import { apiResponse, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 20;

  // Only search if query is at least 1 character
  if (query.length === 0) {
    return apiResponse.ok({ people: [] });
  }

  const people = await prisma.person.findMany({
    where: {
      userId: session.user.id,
      OR: [
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          surname: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          middleName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          secondLastName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          nickname: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      surname: true,
      middleName: true,
      secondLastName: true,
      nickname: true,
    },
    orderBy: {
      name: 'asc',
    },
    take: Number.isFinite(limit) ? limit : 20,
  });

  return apiResponse.ok({ people });
});
