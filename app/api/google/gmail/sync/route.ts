import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { fullSyncForUser } from '@/lib/google/sync';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('gmail-sync-api');

// POST /api/google/gmail/sync - Trigger manual Gmail sync
export const POST = withLogging(async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify integration exists and Gmail sync is enabled
    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'No Google integration found. Connect Google first.' },
        { status: 404 },
      );
    }

    if (!integration.gmailSyncEnabled) {
      return NextResponse.json(
        { error: 'Gmail sync is not enabled for this integration.' },
        { status: 400 },
      );
    }

    // Check if sync is already in progress
    if (integration.syncInProgress) {
      return NextResponse.json(
        { error: 'A sync is already in progress. Please wait for it to complete.' },
        { status: 409 },
      );
    }

    // Mark sync as in progress
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        syncInProgress: true,
        syncStartedAt: new Date(),
      },
    });

    try {
      log.info({ userId: session.user.id }, 'Starting manual Gmail sync');
      const result = await fullSyncForUser(session.user.id);

      // Update sync status
      await prisma.googleIntegration.update({
        where: { id: integration.id },
        data: {
          syncInProgress: false,
          lastGmailSyncAt: new Date(),
          lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
          lastErrorAt: result.errors.length > 0 ? new Date() : null,
        },
      });

      return NextResponse.json({ success: true, data: result });
    } catch (syncError) {
      // Ensure we clear the sync lock on failure
      const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
      await prisma.googleIntegration.update({
        where: { id: integration.id },
        data: {
          syncInProgress: false,
          lastError: errorMessage,
          lastErrorAt: new Date(),
        },
      });
      throw syncError;
    }
  } catch (error) {
    return handleApiError(error, 'gmail-sync-post');
  }
});

// GET /api/google/gmail/sync - Get sync status
export const GET = withLogging(async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
      select: {
        lastGmailSyncAt: true,
        gmailHistoryId: true,
        syncInProgress: true,
        lastError: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'No Google integration found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: integration });
  } catch (error) {
    return handleApiError(error, 'gmail-sync-get');
  }
});
