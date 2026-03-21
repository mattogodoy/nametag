import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { handleApiError, getClientIp, withLogging } from '@/lib/api-utils';
import { securityLogger } from '@/lib/logger';

// GET /api/cron/process-past-events
// Called by cron job to auto-update lastContact for linked people when an event date passes.
export const GET = withLogging(async function GET(request: Request) {
  const startTime = Date.now();
  let cronLogId: string | null = null;

  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
        endpoint: 'process-past-events',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronLog = await prisma.cronJobLog.create({
      data: { jobName: 'process-past-events', status: 'started' },
    });
    cronLogId = cronLog.id;

    const now = new Date();

    // Find unprocessed events whose date has passed
    const pastEvents = await prisma.event.findMany({
      where: {
        date: { lte: now },
        lastContactProcessed: false,
      },
      include: {
        people: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    let processed = 0;

    for (const event of pastEvents) {
      if (event.people.length === 0) {
        // No linked people — just mark processed
        await prisma.event.update({
          where: { id: event.id },
          data: { lastContactProcessed: true },
        });
        processed++;
        continue;
      }

      // Update lastContact for each linked person if event date is more recent
      await prisma.$transaction([
        ...event.people.map((person) =>
          prisma.person.updateMany({
            where: {
              id: person.id,
              userId: event.userId,
              OR: [
                { lastContact: null },
                { lastContact: { lt: event.date } },
              ],
            },
            data: { lastContact: event.date },
          })
        ),
        prisma.event.update({
          where: { id: event.id },
          data: { lastContactProcessed: true },
        }),
      ]);

      processed++;
    }

    await prisma.cronJobLog.update({
      where: { id: cronLogId },
      data: {
        status: 'completed',
        message: `Processed ${processed} past events`,
        duration: Date.now() - startTime,
      },
    });

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    if (cronLogId) {
      await prisma.cronJobLog.update({
        where: { id: cronLogId },
        data: { status: 'failed', message: String(error), duration: Date.now() - startTime },
      }).catch(() => {});
    }
    return handleApiError(error, 'process-past-events');
  }
});
