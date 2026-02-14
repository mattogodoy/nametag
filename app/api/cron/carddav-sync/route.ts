import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { bidirectionalSync } from '@/lib/carddav/sync';
import { env } from '@/lib/env';
import { handleApiError } from '@/lib/api-utils';
import { logger, securityLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/api-utils';

// This endpoint should be called by a cron job
export async function GET(request: Request) {
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    // Verify the cron secret
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'carddav-sync',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log cron job start
    const cronLog = await prisma.cronJobLog.create({
      data: {
        jobName: 'carddav-sync',
        status: 'started',
      },
    });
    cronLogId = cronLog.id;

    const now = new Date();

    // Find all CardDAV connections where sync is enabled
    const connections = await prisma.cardDavConnection.findMany({
      where: {
        syncEnabled: true,
      },
      select: {
        id: true,
        userId: true,
        autoSyncInterval: true,
        lastSyncAt: true,
      },
    });

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each connection with rate limiting
    for (const connection of connections) {
      try {
        // Check if enough time has passed since last sync
        const shouldSync = shouldSyncNow(
          connection.lastSyncAt,
          connection.autoSyncInterval,
          now
        );

        if (!shouldSync) {
          skippedCount++;
          continue;
        }

        // Perform bidirectional sync
        logger.info('Starting background sync', {
          userId: connection.userId,
          connectionId: connection.id,
        });

        const result = await bidirectionalSync(connection.userId);

        logger.info('Background sync completed', {
          userId: connection.userId,
          connectionId: connection.id,
          imported: result.imported,
          exported: result.exported,
          updatedLocally: result.updatedLocally,
          updatedRemotely: result.updatedRemotely,
          conflicts: result.conflicts,
          errors: result.errors,
        });

        syncedCount++;

        // Small delay between users to avoid overwhelming servers
        // Only delay if there are more connections to process
        if (connections.indexOf(connection) < connections.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${connection.userId}: ${errorMessage}`);

        logger.error('Background sync failed', {
          userId: connection.userId,
          connectionId: connection.id,
          error: errorMessage,
        });

        // Update connection with error
        await prisma.cardDavConnection.update({
          where: { id: connection.id },
          data: {
            lastError: errorMessage,
            lastErrorAt: now,
          },
        });

        // Continue with next user even if this one failed
      }
    }

    logger.info('Background CardDAV sync completed', {
      total: connections.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
    });

    // Log cron job completion
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: errorCount > 0 ? 'completed' : 'completed',
          duration,
          message: `Synced ${syncedCount} users, skipped ${skippedCount}, ${errorCount} errors`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: connections.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      errorMessages: errors,
    });
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
    return handleApiError(error, 'cron-carddav-sync');
  }
}

/**
 * Determine if sync should run now based on last sync time and interval
 */
function shouldSyncNow(
  lastSyncAt: Date | null,
  autoSyncInterval: number,
  now: Date
): boolean {
  // If never synced, sync now
  if (!lastSyncAt) {
    return true;
  }

  // Calculate time since last sync in seconds
  const timeSinceLastSync = (now.getTime() - lastSyncAt.getTime()) / 1000;

  // Sync if interval has passed
  return timeSinceLastSync >= autoSyncInterval;
}
