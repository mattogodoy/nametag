import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest, bulkOrphansSchema } from '@/lib/validations';

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(bulkOrphansSchema, body);
    if (!validation.success) return validation.response;

    const { personIds, selectAll } = validation.data;

    // Resolve target person IDs
    let targetIds: string[];
    if (selectAll) {
      const allPeople = await prisma.person.findMany({
        where: { userId: session.user.id },
        select: { id: true },
      });
      targetIds = allPeople.map((p) => p.id);
    } else {
      targetIds = personIds!;
    }

    const targetIdSet = new Set(targetIds);

    // Fetch all people for this user with their relationships
    const allPeopleWithRels = await prisma.person.findMany({
      where: { userId: session.user.id },
      include: {
        relationshipToUser: { select: { id: true } },
        relationshipsFrom: {
          where: { deletedAt: null },
          select: { id: true, relatedPersonId: true },
        },
        relationshipsTo: {
          where: { deletedAt: null },
          select: { id: true, personId: true },
        },
      },
    });

    // Find orphans: people NOT being deleted who would lose ALL connections
    const orphans: { id: string; fullName: string }[] = [];

    for (const person of allPeopleWithRels) {
      // Skip people being deleted
      if (targetIdSet.has(person.id)) continue;

      // Skip people with a direct relationship to user
      if (person.relationshipToUser) continue;

      // Count relationships that would remain after bulk delete
      const remainingFrom = person.relationshipsFrom.filter(
        (r) => r.relatedPersonId && !targetIdSet.has(r.relatedPersonId)
      );
      const remainingTo = person.relationshipsTo.filter(
        (r) => r.personId && !targetIdSet.has(r.personId)
      );

      if (remainingFrom.length === 0 && remainingTo.length === 0) {
        // This person currently has at least one connection to a target
        const hasConnectionToTarget = [
          ...person.relationshipsFrom.filter((r) => r.relatedPersonId && targetIdSet.has(r.relatedPersonId)),
          ...person.relationshipsTo.filter((r) => r.personId && targetIdSet.has(r.personId)),
        ].length > 0;

        if (hasConnectionToTarget) {
          orphans.push({
            id: person.id,
            fullName: formatFullName(person),
          });
        }
      }
    }

    // Check if user has CardDAV sync
    const cardDavConnection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    return apiResponse.ok({
      orphans,
      hasCardDavSync: !!cardDavConnection,
    });
  } catch (error) {
    return handleApiError(error, 'people-bulk-orphans');
  }
});
