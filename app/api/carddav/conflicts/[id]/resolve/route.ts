import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { syncToServer } from '@/lib/carddav/sync';
import { updatePersonFromVCardInTransaction, savePhotoForPerson } from '@/lib/carddav/person-from-vcard';
import type { ParsedVCardData } from '@/lib/carddav/types';
import { createModuleLogger } from '@/lib/logger';
import { withLogging, type RouteContext } from '@/lib/api-utils';
import { z } from 'zod';

const log = createModuleLogger('carddav');

const resolveSchema = z.object({
  resolution: z.enum(['keep_local', 'keep_remote', 'merged']),
});

export const POST = withLogging(async function POST(request: Request, context?: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context!.params;
    const validationResult = resolveSchema.safeParse(await request.json());

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid resolution type', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { resolution } = validationResult.data;

    // Get conflict
    const conflict = await prisma.cardDavConflict.findUnique({
      where: { id },
      include: {
        mapping: {
          include: {
            person: {
              include: {
                phoneNumbers: true,
                emails: true,
                addresses: true,
                urls: true,
                imHandles: true,
                locations: true,
                customFields: true,
              },
            },
            connection: true,
          },
        },
      },
    });

    if (!conflict) {
      return NextResponse.json(
        { error: 'Conflict not found' },
        { status: 404 }
      );
    }

    // Verify user owns this connection
    if (conflict.mapping.connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Already resolved?
    if (conflict.resolvedAt) {
      return NextResponse.json(
        { error: 'Conflict already resolved' },
        { status: 400 }
      );
    }

    if (resolution === 'keep_local') {
      // Keep local version - mark as resolved, set sync status to pending push
      await prisma.cardDavConflict.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolution: 'keep_local',
          resolvedBy: 'user',
        },
      });

      await prisma.cardDavMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    } else if (resolution === 'keep_remote') {
      // Keep remote version - update person with remote data.
      // remoteVersion is already ParsedVCardData (stored by syncFromServer),
      // not raw vCard text, so use it directly.
      const remoteData = JSON.parse(conflict.remoteVersion) as ParsedVCardData;

      // Wrap all operations in a single interactive transaction for atomicity
      await prisma.$transaction(async (tx) => {
        // Update person with remote data (delete multi-value fields + recreate)
        await updatePersonFromVCardInTransaction(
          tx,
          conflict.mapping.personId,
          remoteData,
        );

        await tx.cardDavConflict.update({
          where: { id },
          data: {
            resolvedAt: new Date(),
            resolution: 'keep_remote',
            resolvedBy: 'user',
          },
        });

        await tx.cardDavMapping.update({
          where: { id: conflict.mappingId },
          data: {
            syncStatus: 'synced',
            lastRemoteChange: new Date(),
            lastSyncedAt: new Date(),
          },
        });
      });

      // Save photo as file if present (outside transaction - file I/O)
      if (remoteData.photo) {
        await savePhotoForPerson(
          session.user.id,
          conflict.mapping.personId,
          remoteData.photo,
        );
      }
    } else if (resolution === 'merged') {
      // For merged, we expect the client to send the merged data
      // This is handled separately - for now just mark as resolved
      await prisma.cardDavConflict.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          resolution: 'merged',
          resolvedBy: 'user',
        },
      });

      await prisma.cardDavMapping.update({
        where: { id: conflict.mappingId },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    }

    // Push pending changes to server in the background
    if (resolution === 'keep_local' || resolution === 'merged') {
      syncToServer(session.user.id).catch((error) => {
        log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Background sync after conflict resolution failed');
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error resolving conflict');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
