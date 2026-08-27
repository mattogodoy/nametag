import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { createLabelResolver } from '@/lib/relationship-labels';

const RETENTION_DAYS = 30;

// GET /api/deleted - List soft-deleted items by type
export const GET = withAuth(async (request, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Calculate cutoff date - only show items deleted within retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    let deleted;

    switch (type) {
      case 'people':
        deleted = await prismaIncludingDeleted.person.findMany({
          where: {
            userId: session.user.id,
            deletedAt: { not: null, gte: cutoffDate },
          },
          select: {
            id: true,
            name: true,
            surname: true,
            nickname: true,
            displayNameOverride: true,
            deletedAt: true,
          },
          orderBy: { deletedAt: 'desc' },
        });
        break;

      case 'groups':
        deleted = await prismaIncludingDeleted.group.findMany({
          where: {
            userId: session.user.id,
            deletedAt: { not: null, gte: cutoffDate },
          },
          select: {
            id: true,
            name: true,
            description: true,
            color: true,
            deletedAt: true,
          },
          orderBy: { deletedAt: 'desc' },
        });
        break;

      case 'relationships': {
        const deletedRelationships = await prismaIncludingDeleted.relationship.findMany({
          where: {
            person: { userId: session.user.id },
            deletedAt: { not: null, gte: cutoffDate },
          },
          select: {
            id: true,
            deletedAt: true,
            person: {
              select: { id: true, name: true, surname: true },
            },
            relatedPerson: {
              select: { id: true, name: true, surname: true },
            },
            relationshipType: {
              select: { id: true, label: true },
            },
          },
          orderBy: { deletedAt: 'desc' },
        });

        // A deleted relationship may involve people who are themselves
        // deleted. The resolver only loads context for live people, so it
        // naturally falls back to the type's own label there, which is the
        // correct behaviour for a trash row rather than a bug to work around.
        const relationshipPersonIds = Array.from(
          new Set(deletedRelationships.flatMap((rel) => [rel.person.id, rel.relatedPerson.id]))
        );
        const resolver = await createLabelResolver(session.user.id, relationshipPersonIds);

        deleted = deletedRelationships.map((rel) => ({
          ...rel,
          resolvedLabel: rel.relationshipType
            ? resolver.resolve({
                relationshipTypeId: rel.relationshipType.id,
                typeLabel: rel.relationshipType.label,
                describedPersonId: rel.person.id,
                otherPersonId: rel.relatedPerson.id,
              }).label
            : null,
        }));
        break;
      }

      case 'relationshipTypes':
        deleted = await prismaIncludingDeleted.relationshipType.findMany({
          where: {
            userId: session.user.id,
            deletedAt: { not: null, gte: cutoffDate },
          },
          select: {
            id: true,
            name: true,
            label: true,
            color: true,
            deletedAt: true,
          },
          orderBy: { deletedAt: 'desc' },
        });
        break;

      case 'importantDates':
        deleted = await prismaIncludingDeleted.importantDate.findMany({
          where: {
            person: { userId: session.user.id },
            deletedAt: { not: null, gte: cutoffDate },
          },
          select: {
            id: true,
            title: true,
            date: true,
            deletedAt: true,
            person: {
              select: { id: true, name: true, surname: true },
            },
          },
          orderBy: { deletedAt: 'desc' },
        });
        break;

      default:
        return apiResponse.error(
          'Invalid type parameter. Must be one of: people, groups, relationships, relationshipTypes, importantDates'
        );
    }

    return apiResponse.ok({
      deleted,
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, 'deleted-list');
  }
});
