import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { apiError, validationFailed } from '@/lib/api-errors';
import { z } from 'zod';

const dismissSchema = z.object({
  personAId: z.string().min(1),
  personBId: z.string().min(1),
});

// POST /api/people/duplicates/dismiss - Dismiss a duplicate pair
export const POST = withAuth(async (request, session) => {
  try {
    const body: unknown = await request.json();
    const parsed = dismissSchema.safeParse(body);

    if (!parsed.success) {
      return validationFailed(parsed.error.issues, 'Invalid request body');
    }

    const { personAId, personBId } = parsed.data;

    if (personAId === personBId) {
      return apiError('self_relationship', 'Cannot dismiss a person with themselves');
    }

    // Always store with smaller ID first for consistent lookups
    const [smallerId, largerId] =
      personAId < personBId ? [personAId, personBId] : [personBId, personAId];

    // Verify both people belong to this user
    const people = await prisma.person.findMany({
      where: {
        id: { in: [smallerId, largerId] },
        userId: session.user.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (people.length !== 2) {
      return apiResponse.notFound('One or both people not found');
    }

    await prisma.duplicateDismissal.upsert({
      where: {
        userId_personAId_personBId: {
          userId: session.user.id,
          personAId: smallerId,
          personBId: largerId,
        },
      },
      create: {
        userId: session.user.id,
        personAId: smallerId,
        personBId: largerId,
      },
      update: {},
    });

    return apiResponse.ok({ dismissed: true });
  } catch (error) {
    return handleApiError(error, 'people-duplicates-dismiss');
  }
});
