import { withDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

const RETENTION_DAYS = 30;

// GET /api/deleted - List soft-deleted items by type
export const GET = withAuth(async (request, session) => {
  const prismaWithDeleted = withDeleted();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Calculate cutoff date - only show items deleted within retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    let deleted;

    switch (type) {
      case 'people':
        deleted = await prismaWithDeleted.person.findMany({
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
        deleted = await prismaWithDeleted.group.findMany({
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

      case 'relationships':
        deleted = await prismaWithDeleted.relationship.findMany({
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
        break;

      case 'relationshipTypes':
        deleted = await prismaWithDeleted.relationshipType.findMany({
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
        deleted = await prismaWithDeleted.importantDate.findMany({
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
  } finally {
    await prismaWithDeleted.$disconnect();
  }
});
