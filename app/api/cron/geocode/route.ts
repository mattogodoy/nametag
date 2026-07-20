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

// Guards against overlapping runs in this process (a slow run overlapping the
// next scheduled one, or a manual trigger during a scheduled run). Overlaps
// double the geocoder traffic for no benefit since both runs would pick up
// the same rows.
let runInProgress = false;

export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  updateContext({ jobId: `geocode:${randomUUID()}` });

  let cronLogId: string | null = null;
  let acquiredRunLock = false;

  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', { endpoint: 'geocode' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (env.DISABLE_GEOCODING) {
      return NextResponse.json({ success: true, disabled: true, reason: 'Geocoding disabled' });
    }

    if (runInProgress) {
      log.info({ event: 'cron.geocode.already_running' });
      return NextResponse.json({ success: true, alreadyRunning: true, reason: 'A geocode run is already in progress' });
    }
    runInProgress = true;
    acquiredRunLock = true;

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
    let rateLimited = false;

    for (const address of addresses) {
      try {
        const outcome = await geocodeSingleAddress(address);
        if (outcome === 'success') geocoded++;
        else if (outcome === 'failed') failed++;
        else if (outcome === 'pending') pending++;
        else if (outcome === 'rate_limited') {
          // The provider asked us to back off: stop the batch instead of
          // feeding it more traffic. Untouched rows stay eligible for the
          // next run.
          pending++;
          rateLimited = true;
          log.warn({ event: 'cron.geocode.rate_limited', remaining: addresses.length - (geocoded + failed + pending + skipped) });
          break;
        } else skipped++;
      } catch (error) {
        log.warn({
          event: 'cron.geocode.item_failed',
          addressId: address.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Leave the record eligible for the next run instead of aborting the batch.
        pending++;
      }
    }

    const processed = geocoded + failed + pending + skipped;

    log.info({
      event: 'cron.geocode.finished',
      processed,
      geocoded,
      failed,
      pending,
      skipped,
      rateLimited,
      durationMs: Date.now() - startTime,
    });

    await prisma.cronJobLog.update({
      where: { id: cronLogId },
      data: {
        status: pending > 0 ? 'completed_with_errors' : 'completed',
        duration: Date.now() - startTime,
        message: `Processed ${processed} of ${addresses.length} addresses: ${geocoded} geocoded, ${failed} failed, ${pending} pending, ${skipped} skipped${rateLimited ? ' (stopped early: provider rate limited)' : ''}`,
      },
    });

    return NextResponse.json({
      success: true,
      processed,
      geocoded,
      failed,
      pending,
      skipped,
      rateLimited,
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
  } finally {
    if (acquiredRunLock) {
      runInProgress = false;
    }
  }
});
