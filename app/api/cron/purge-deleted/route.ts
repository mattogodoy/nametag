import { NextResponse } from 'next/server';
import { withDeleted, prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { handleApiError, getClientIp } from '@/lib/api-utils';
import { logger, securityLogger } from '@/lib/logger';
import { deletePersonPhotos } from '@/lib/photo-storage';

const RETENTION_DAYS = 30;

// GET /api/cron/purge-deleted - Permanently delete records older than retention period
// This endpoint should be called by a cron job daily
export async function GET(request: Request) {
  const prismaWithDeleted = withDeleted();
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    // Verify the cron secret
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'purge-deleted',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log cron job start
    const cronLog = await prisma.cronJobLog.create({
      data: {
        jobName: 'purge-deleted',
        status: 'started',
      },
    });
    cronLogId = cronLog.id;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    // Purge in order to respect foreign key constraints
    // Track counts for each entity type
    const purged = {
      importantDates: 0,
      personGroups: 0,
      relationships: 0,
      groups: 0,
      relationshipTypes: 0,
      people: 0,
    };

    // 1. Purge ImportantDates that are soft-deleted past retention
    const importantDatesResult = await prismaWithDeleted.importantDate.deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });
    purged.importantDates = importantDatesResult.count;

    // 2. Get IDs of persons to be purged (for cleaning up related data)
    const personsToDelete = await prismaWithDeleted.person.findMany({
      where: { deletedAt: { not: null, lt: cutoffDate } },
      select: { id: true, userId: true },
    });
    const personIds = personsToDelete.map((p: { id: string }) => p.id);

    // Delete photo files for persons being purged
    for (const person of personsToDelete as { id: string; userId: string }[]) {
      await deletePersonPhotos(person.userId, person.id);
    }

    // 3. Delete PersonGroups for persons being purged
    if (personIds.length > 0) {
      const personGroupsResult = await prismaWithDeleted.personGroup.deleteMany({
        where: { personId: { in: personIds } },
      });
      purged.personGroups += personGroupsResult.count;

      // Also delete ImportantDates for persons being purged (even if not soft-deleted)
      const orphanedDatesResult = await prismaWithDeleted.importantDate.deleteMany({
        where: { personId: { in: personIds } },
      });
      purged.importantDates += orphanedDatesResult.count;
    }

    // 4. Purge Relationships that are soft-deleted past retention
    const relationshipsResult = await prismaWithDeleted.relationship.deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });
    purged.relationships = relationshipsResult.count;

    // Also delete relationships where either person is being purged
    if (personIds.length > 0) {
      const orphanedRelationshipsResult = await prismaWithDeleted.relationship.deleteMany({
        where: {
          OR: [
            { personId: { in: personIds } },
            { relatedPersonId: { in: personIds } },
          ],
        },
      });
      purged.relationships += orphanedRelationshipsResult.count;
    }

    // 5. Get IDs of groups to be purged
    const groupsToDelete = await prismaWithDeleted.group.findMany({
      where: { deletedAt: { not: null, lt: cutoffDate } },
      select: { id: true },
    });
    const groupIds = groupsToDelete.map((g: { id: string }) => g.id);

    // Delete PersonGroups for groups being purged
    if (groupIds.length > 0) {
      const groupPersonGroupsResult = await prismaWithDeleted.personGroup.deleteMany({
        where: { groupId: { in: groupIds } },
      });
      purged.personGroups += groupPersonGroupsResult.count;
    }

    // 6. Purge Groups that are soft-deleted past retention
    const groupsResult = await prismaWithDeleted.group.deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });
    purged.groups = groupsResult.count;

    // 7. Get IDs of relationship types to be purged
    const relationshipTypesToDelete = await prismaWithDeleted.relationshipType.findMany({
      where: { deletedAt: { not: null, lt: cutoffDate } },
      select: { id: true },
    });
    const relationshipTypeIds = relationshipTypesToDelete.map((r: { id: string }) => r.id);

    if (relationshipTypeIds.length > 0) {
      // Clear relationshipToUserId references to deleted types
      await prismaWithDeleted.person.updateMany({
        where: { relationshipToUserId: { in: relationshipTypeIds } },
        data: { relationshipToUserId: null },
      });

      // Clear relationship references to deleted types
      await prismaWithDeleted.relationship.updateMany({
        where: { relationshipTypeId: { in: relationshipTypeIds } },
        data: { relationshipTypeId: null },
      });

      // Clear inverse references
      await prismaWithDeleted.relationshipType.updateMany({
        where: { inverseId: { in: relationshipTypeIds } },
        data: { inverseId: null },
      });
    }

    // 8. Purge RelationshipTypes that are soft-deleted past retention
    const relationshipTypesResult = await prismaWithDeleted.relationshipType.deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });
    purged.relationshipTypes = relationshipTypesResult.count;

    // 9. Finally purge Persons that are soft-deleted past retention
    const peopleResult = await prismaWithDeleted.person.deleteMany({
      where: {
        deletedAt: { not: null, lt: cutoffDate },
      },
    });
    purged.people = peopleResult.count;

    const result = {
      success: true,
      purged,
      retentionDays: RETENTION_DAYS,
      cutoffDate: cutoffDate.toISOString(),
    };

    logger.info(result, 'Purge completed');

    // Log cron job completion
    if (cronLogId) {
      const duration = Date.now() - startTime;
      const totalPurged = Object.values(purged).reduce((a, b) => a + b, 0);
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'completed',
          duration,
          message: `Purged ${totalPurged} records (${purged.people} people, ${purged.groups} groups, ${purged.relationships} relationships, ${purged.relationshipTypes} relationship types, ${purged.importantDates} important dates, ${purged.personGroups} person-groups)`,
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    // Log cron job failure
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'failed',
          duration,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
    return handleApiError(error, 'cron-purge-deleted');
  } finally {
    await prismaWithDeleted.$disconnect();
  }
}
