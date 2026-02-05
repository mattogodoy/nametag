import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// GET /api/relationships/to-user - List person-to-user relationships
export const GET = withAuth(async (request, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const relationshipTypeId = searchParams.get('relationshipTypeId') || undefined;
    const relationshipTypeName = searchParams.get('relationshipTypeName') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : undefined;

    const relationshipTypeFilter: {
      userId: string;
      deletedAt: null;
      id?: string;
      name?: { equals: string; mode: 'insensitive' };
    } = {
      userId: session.user.id,
      deletedAt: null,
    };

    if (relationshipTypeId) {
      relationshipTypeFilter.id = relationshipTypeId;
    }

    if (relationshipTypeName) {
      relationshipTypeFilter.name = { equals: relationshipTypeName, mode: 'insensitive' };
    }

    const people = await prisma.person.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        relationshipToUserId: { not: null },
        relationshipToUser: relationshipTypeFilter,
      },
      orderBy: { updatedAt: 'desc' },
      take: Number.isFinite(limit) ? limit : undefined,
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        relationshipToUser: {
          select: {
            id: true,
            name: true,
            label: true,
            color: true,
            inverseId: true,
          },
        },
      },
    });

    return apiResponse.ok({ people });
  } catch (error) {
    return handleApiError(error, 'relationships-to-user');
  }
});
