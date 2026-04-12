import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { encryptPassword } from '@/lib/carddav/encryption';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('google-connect');

// GET /api/google/connect - Get Google integration status
export const GET = withLogging(async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
      select: {
        authMode: true,
        gmailSyncEnabled: true,
        driveSyncEnabled: true,
        lastGmailSyncAt: true,
        lastError: true,
        syncInProgress: true,
      },
    });

    if (!integration) {
      return NextResponse.json({
        connected: false,
      });
    }

    return NextResponse.json({
      connected: true,
      ...integration,
    });
  } catch (error) {
    return handleApiError(error, 'google-connect-get');
  }
});

// POST /api/google/connect - Create or update Google integration
export const POST = withLogging(async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      authMode,
      serviceAccountKey,
      delegatedEmail,
      gmailSyncEnabled,
      driveSyncEnabled,
      autoSyncInterval,
      driveFolderName,
      calendarSyncEnabled,
      birthdayCalendarId,
      ocrEnabled,
    } = body;

    if (!authMode || !['oauth', 'service_account'].includes(authMode)) {
      return NextResponse.json(
        { error: 'Invalid authMode. Must be "oauth" or "service_account".' },
        { status: 400 },
      );
    }

    // For service_account mode, the key is required
    if (authMode === 'service_account' && !serviceAccountKey) {
      // Allow update without key if integration already exists with a key
      const existing = await prisma.googleIntegration.findUnique({
        where: { userId: session.user.id },
      });
      if (!existing?.serviceAccountKey) {
        return NextResponse.json(
          { error: 'serviceAccountKey is required for service_account mode' },
          { status: 400 },
        );
      }
    }

    // Build the data object
    const data: Record<string, unknown> = {
      authMode,
    };

    if (serviceAccountKey) {
      // Validate that the key is valid JSON before encrypting
      try {
        JSON.parse(serviceAccountKey);
      } catch {
        return NextResponse.json(
          { error: 'serviceAccountKey must be valid JSON' },
          { status: 400 },
        );
      }
      data.serviceAccountKey = encryptPassword(serviceAccountKey);
    }

    if (delegatedEmail !== undefined) {
      data.delegatedEmail = delegatedEmail;
    }
    if (gmailSyncEnabled !== undefined) {
      data.gmailSyncEnabled = gmailSyncEnabled;
    }
    if (driveSyncEnabled !== undefined) {
      data.driveSyncEnabled = driveSyncEnabled;
    }
    if (autoSyncInterval !== undefined) {
      if (typeof autoSyncInterval !== 'number' || autoSyncInterval < 60 || autoSyncInterval > 86400) {
        return NextResponse.json(
          { error: 'autoSyncInterval must be between 60 and 86400 seconds' },
          { status: 400 },
        );
      }
      data.autoSyncInterval = autoSyncInterval;
    }
    if (driveFolderName !== undefined) {
      if (typeof driveFolderName !== 'string' || driveFolderName.trim().length === 0) {
        return NextResponse.json(
          { error: 'driveFolderName must be a non-empty string' },
          { status: 400 },
        );
      }
      data.driveFolderName = driveFolderName.trim();
      // Reset the cached folder ID since the name changed
      data.driveRootFolderId = null;
    }
    if (calendarSyncEnabled !== undefined) {
      data.calendarSyncEnabled = calendarSyncEnabled;
    }
    if (birthdayCalendarId !== undefined) {
      data.birthdayCalendarId = birthdayCalendarId;
    }
    if (ocrEnabled !== undefined) {
      data.ocrEnabled = ocrEnabled;
    }

    // Upsert the integration
    const integration = await prisma.googleIntegration.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...(data as Record<string, string | boolean | number | null>),
      },
      update: data,
    });

    // Return safe fields (exclude encrypted tokens/keys)
    const safeIntegration = {
      id: integration.id,
      authMode: integration.authMode,
      delegatedEmail: integration.delegatedEmail,
      gmailSyncEnabled: integration.gmailSyncEnabled,
      driveSyncEnabled: integration.driveSyncEnabled,
      driveFolderName: integration.driveFolderName,
      calendarSyncEnabled: integration.calendarSyncEnabled,
      birthdayCalendarId: integration.birthdayCalendarId,
      autoSyncInterval: integration.autoSyncInterval,
      lastGmailSyncAt: integration.lastGmailSyncAt,
      lastCalendarSyncAt: integration.lastCalendarSyncAt,
      lastError: integration.lastError,
      syncInProgress: integration.syncInProgress,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };

    return NextResponse.json({ success: true, data: safeIntegration }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'google-connect-post');
  }
});

// DELETE /api/google/connect - Disconnect Google integration
export const DELETE = withLogging(async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'No Google integration found' },
        { status: 404 },
      );
    }

    // Delete the integration - cascade will remove EmailLog and Document records
    await prisma.googleIntegration.delete({
      where: { userId: session.user.id },
    });

    log.info({ userId: session.user.id }, 'Google integration disconnected');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'google-connect-delete');
  }
});
