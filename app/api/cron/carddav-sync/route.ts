import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { bidirectionalSync } from '@/lib/carddav/sync';
import { env } from '@/lib/env';
import { handleApiError, withLogging, getClientIp } from '@/lib/api-utils';
import { createModuleLogger, securityLogger } from '@/lib/logger';
import { runWithContext, updateContext } from '@/lib/logging/context';

const log = createModuleLogger('cron-carddav');

export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  const jobId = `carddav-sync:${randomUUID()}`;
  updateContext({ jobId });

  let cronLogId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', { endpoint: 'carddav-sync' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronLog = await prisma.cronJobLog.create({
      data: { jobName: 'carddav-sync', status: 'started' },
    });
    cronLogId = cronLog.id;

    const now = new Date();
    const connections = await prisma.cardDavConnection.findMany({
      where: { syncEnabled: true },
      select: { id: true, userId: true, autoSyncInterval: true, lastSyncAt: true },
    });

    log.info({ event: 'cron.carddav.started', totalUsers: connections.length });

    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const connection of connections) {
      const shouldSync = shouldSyncNow(connection.lastSyncAt, connection.autoSyncInterval, now);
      if (!shouldSync) {
        skippedCount++;
        continue;
      }

      await runWithContext(
        { requestId: randomUUID(), userId: connection.userId, jobId, connectionId: connection.id },
        async () => {
          try {
            log.info({ event: 'cron.carddav.iteration.started' }, 'Starting background sync');
            const result = await bidirectionalSync(connection.userId);
            log.info(
              {
                event: 'cron.carddav.iteration.completed',
                imported: result.imported,
                exported: result.exported,
                updatedLocally: result.updatedLocally,
                updatedRemotely: result.updatedRemotely,
                conflicts: result.conflicts,
                errors: result.errors,
              },
              'Background sync completed',
            );
            syncedCount++;
          } catch (error) {
            errorCount++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`User ${connection.userId}: ${errorMessage}`);
            log.error(
              {
                event: 'cron.carddav.iteration.failed',
                err: error instanceof Error ? error : new Error(String(error)),
              },
              'Background sync failed',
            );
            await prisma.cardDavConnection.update({
              where: { id: connection.id },
              data: { lastError: errorMessage, lastErrorAt: now },
            });
          }
        },
      );

      if (connections.indexOf(connection) < connections.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    log.info({
      event: 'cron.carddav.finished',
      totalUsers: connections.length,
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      durationMs: Date.now() - startTime,
    });

    if (cronLogId) {
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: errorCount > 0 ? 'completed_with_errors' : 'completed',
          duration: Date.now() - startTime,
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
    if (cronLogId) {
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: {
          status: 'failed',
          duration: Date.now() - startTime,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
    return handleApiError(error, 'cron-carddav-sync');
  }
});

function shouldSyncNow(lastSyncAt: Date | null, autoSyncInterval: number, now: Date): boolean {
  if (!lastSyncAt) return true;
  const timeSinceLastSync = (now.getTime() - lastSyncAt.getTime()) / 1000;
  return timeSinceLastSync >= autoSyncInterval;
}
