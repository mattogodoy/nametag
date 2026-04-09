import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fullSyncForUser } from '@/lib/google/sync';
import { env } from '@/lib/env';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { logger, securityLogger } from '@/lib/logger';
import { getClientIp } from '@/lib/api-utils';

// This endpoint should be called by a cron job
export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    // Verify the cron secret
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'gmail-sync',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log cron job start
    const cronLog = await prisma.cronJobLog.create({
      data: {
        jobName: 'gmail-sync',
        status: 'started',
      },
    });
    cronLogId = cronLog.id;

    const now = new Date();

    // Find all Google integrations where Gmail sync is enabled
    const integrations = await prisma.googleIntegration.findMany({
      where: {
        gmailSyncEnabled: true,
      },
      select: {
        id: true,
        userId: true,
        autoSyncInterval: true,
        lastGmailSyncAt: true,
      },
    });

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each integration with rate limiting
    for (const integration of integrations) {
      try {
        // Check if enough time has passed since last sync
        const shouldSync = shouldSyncNow(
          integration.lastGmailSyncAt,
          integration.autoSyncInterval,
          now
        );

        if (!shouldSync) {
          skippedCount++;
          continue;
        }

        // Perform Gmail sync
        logger.info({
          userId: integration.userId,
          integrationId: integration.id,
        }, 'Starting background Gmail sync');

        const result = await fullSyncForUser(integration.userId);

        logger.info({
          userId: integration.userId,
          integrationId: integration.id,
          newEmails: result.newEmails,
          matchedToContacts: result.matchedToContacts,
          attachmentsProcessed: result.attachmentsProcessed,
          errors: result.errors,
        }, 'Background Gmail sync completed');

        syncedCount++;

        // Small delay between users to avoid overwhelming servers
        // Only delay if there are more integrations to process
        if (integrations.indexOf(integration) < integrations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${integration.userId}: ${errorMessage}`);

        logger.error({
          userId: integration.userId,
          integrationId: integration.id,
          errorMessage,
        }, 'Background Gmail sync failed');

        // Update integration with error
        await prisma.googleIntegration.update({
          where: { id: integration.id },
          data: {
            lastError: errorMessage,
            lastErrorAt: now,
          },
        });

        // Continue with next user even if this one failed
      }
    }

    logger.info({
      total: integrations.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
    }, 'Background Gmail sync completed');

    // Log cron job completion
    if (cronLogId) {
      const duration = Date.now() - startTime;
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: errorCount > 0 ? 'completed_with_errors' : 'completed',
          duration,
          message: `Synced ${syncedCount} users, skipped ${skippedCount}, ${errorCount} errors`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: integrations.length,
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
    return handleApiError(error, 'cron-gmail-sync');
  }
});

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
