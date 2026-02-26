import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest, bulkActionSchema } from '@/lib/validations';
import { deleteFromCardDav as deleteContactFromCardDav } from '@/lib/carddav/delete-contact';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('people-bulk');

async function resolvePersonIds(
  personIds: string[] | undefined,
  selectAll: boolean | undefined,
  userId: string
): Promise<string[]> {
  if (!selectAll && (!personIds || personIds.length === 0)) {
    return [];
  }
  if (selectAll) {
    const allPeople = await prisma.person.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return allPeople.map((p) => p.id);
  }
  const people = await prisma.person.findMany({
    where: { id: { in: personIds! }, userId, deletedAt: null },
    select: { id: true },
  });
  return people.map((p) => p.id);
}

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(bulkActionSchema, body);
    if (!validation.success) return validation.response;

    const data = validation.data;

    switch (data.action) {
      case 'delete': {
        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        // Validate orphan IDs belong to the current user
        let validOrphanIds: string[] = [];
        if (data.orphanIds && data.orphanIds.length > 0) {
          const validOrphans = await prisma.person.findMany({
            where: { id: { in: data.orphanIds }, userId: session.user.id },
            select: { id: true },
          });
          validOrphanIds = validOrphans.map((o) => o.id);
        }

        // If requested, delete from CardDAV server (do this before soft-deleting)
        if (data.deleteFromCardDav) {
          const allIdsToDelete = [...ids, ...validOrphanIds];
          for (const id of allIdsToDelete) {
            await deleteContactFromCardDav(id).catch((error) => {
              log.error(
                { err: error instanceof Error ? error : new Error(String(error)), personId: id },
                'Failed to delete from CardDAV server'
              );
            });
          }
        }

        // Always delete the CardDAV mappings when deleting people
        // This allows re-importing the contacts if they still exist on the server
        const allIdsForMapping = [...ids, ...(data.deleteOrphans ? validOrphanIds : [])];
        await prisma.cardDavMapping.deleteMany({
          where: { personId: { in: allIdsForMapping } },
        });

        // Soft delete the people (set deletedAt instead of removing)
        const result = await prisma.person.updateMany({
          where: { id: { in: ids }, userId: session.user.id },
          data: { deletedAt: new Date() },
        });

        // If requested, also soft delete the orphans
        if (data.deleteOrphans && validOrphanIds.length > 0) {
          await prisma.person.updateMany({
            where: { id: { in: validOrphanIds }, userId: session.user.id },
            data: { deletedAt: new Date() },
          });
        }

        return apiResponse.ok({ success: true, affectedCount: result.count });
      }

      case 'addToGroups': {
        // Validate all group IDs belong to the current user
        const validGroups = await prisma.group.findMany({
          where: { id: { in: data.groupIds }, userId: session.user.id },
          select: { id: true },
        });
        const validGroupIds = validGroups.map((g) => g.id);
        if (validGroupIds.length === 0) {
          return apiResponse.notFound('No valid groups found');
        }

        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        // Find existing memberships to avoid duplicates
        const existingMemberships = await prisma.personGroup.findMany({
          where: {
            personId: { in: ids },
            groupId: { in: validGroupIds },
          },
          select: { personId: true, groupId: true },
        });

        const existingSet = new Set(
          existingMemberships.map((m) => `${m.personId}:${m.groupId}`)
        );

        // Build list of new memberships, excluding already-existing ones
        const newMemberships: { personId: string; groupId: string }[] = [];
        for (const personId of ids) {
          for (const groupId of validGroupIds) {
            if (!existingSet.has(`${personId}:${groupId}`)) {
              newMemberships.push({ personId, groupId });
            }
          }
        }

        if (newMemberships.length > 0) {
          await prisma.personGroup.createMany({
            data: newMemberships,
            skipDuplicates: true,
          });
        }

        return apiResponse.ok({ success: true, affectedCount: ids.length });
      }

      case 'setRelationship': {
        // Validate the relationship type exists and belongs to the user
        const relType = await prisma.relationshipType.findUnique({
          where: { id: data.relationshipTypeId },
          select: { id: true, userId: true },
        });

        if (!relType || relType.userId !== session.user.id) {
          return apiResponse.notFound('Relationship type not found');
        }

        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        const result = await prisma.person.updateMany({
          where: { id: { in: ids }, userId: session.user.id },
          data: { relationshipToUserId: data.relationshipTypeId },
        });

        return apiResponse.ok({ success: true, affectedCount: result.count });
      }
    }
  } catch (error) {
    return handleApiError(error, 'people-bulk');
  }
});
