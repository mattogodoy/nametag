import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { handleApiError, withLogging, getClientIp } from '@/lib/api-utils';
import { createModuleLogger, securityLogger } from '@/lib/logger';
import { updateContext } from '@/lib/logging/context';
import { geocodeSingleAddress } from '@/lib/geocoding/geocode-person';

const log = createModuleLogger('cron-geocode');

// Bounded batch per run: at 1 request/second a full batch takes under a
// minute, keeping runs short even when a large backlog exists.
const BATCH_SIZE = 50;

export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  updateContext({ jobId: `geocode:${randomUUID()}` });

  let cronLogId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', { endpoint: 'geocode' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (env.DISABLE_GEOCODING) {
      return NextResponse.json({ success: true, skipped: true, reason: 'Geocoding disabled' });
    }

    const cronLog = await prisma.cronJobLog.create({
      data: { jobName: 'geocode', status: 'started' },
    });
    cronLogId = cronLog.id;

    const addresses = await prisma.personAddress.findMany({
      where: {
        OR: [{ geocodeStatus: null }, { geocodeStatus: 'pending' }],
        person: { deletedAt: null, user: { geocodingEnabled: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    log.info({ event: 'cron.geocode.started', batch: addresses.length });

    let geocoded = 0;
    let failed = 0;
    let pending = 0;
    let skipped = 0;

    for (const address of addresses) {
      const outcome = await geocodeSingleAddress(address);
      if (outcome === 'success') geocoded++;
      else if (outcome === 'failed') failed++;
      else if (outcome === 'pending') pending++;
      else skipped++;
    }

    log.info({
      event: 'cron.geocode.finished',
      processed: addresses.length,
      geocoded,
      failed,
      pending,
      skipped,
      durationMs: Date.now() - startTime,
    });

    await prisma.cronJobLog.update({
      where: { id: cronLogId },
      data: {
        status: pending > 0 ? 'completed_with_errors' : 'completed',
        duration: Date.now() - startTime,
        message: `Processed ${addresses.length} addresses: ${geocoded} geocoded, ${failed} failed, ${pending} pending, ${skipped} skipped`,
      },
    });

    return NextResponse.json({
      success: true,
      processed: addresses.length,
      geocoded,
      failed,
      pending,
      skipped,
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
    return handleApiError(error, 'cron-geocode');
  }
});
