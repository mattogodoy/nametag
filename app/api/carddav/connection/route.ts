import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptPassword } from '@/lib/carddav/encryption';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { createModuleLogger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';
import { z } from 'zod';

const log = createModuleLogger('carddav');

const connectionSchema = z.object({
  serverUrl: z.string().url().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  provider: z.string().nullable().optional(),
  syncEnabled: z.boolean().optional(),
  autoExportNew: z.boolean().optional(),
  autoSyncInterval: z.number().int().min(60).max(86400).optional(), // 1 min to 24 hours
  importMode: z.enum(['manual', 'notify', 'auto']).optional(),
  addressBookUrl: z.string().url().nullish(),
  addressBookName: z.string().nullish(),
  cardDavNameFormat: z.enum(['FULL', 'FIRST_LAST', 'NICKNAME_PREFERRED', 'SHORT']).optional(),
});

const updateConnectionSchema = z.object({
  serverUrl: z.string().url().min(1).optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  provider: z.string().nullable().optional(),
  syncEnabled: z.boolean().optional(),
  autoExportNew: z.boolean().optional(),
  autoSyncInterval: z.number().int().min(60).max(86400).optional(),
  importMode: z.enum(['manual', 'notify', 'auto']).optional(),
  cardDavNameFormat: z.enum(['FULL', 'FIRST_LAST', 'NICKNAME_PREFERRED', 'SHORT']).optional(),
});

export const POST = withLogging(async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = connectionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const {
      serverUrl,
      username,
      password,
      provider,
      syncEnabled,
      autoExportNew,
      autoSyncInterval,
      importMode,
      addressBookUrl,
      addressBookName,
      cardDavNameFormat,
    } = validationResult.data;

    // Validate URL to prevent SSRF attacks
    try {
      await validateServerUrl(serverUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid server URL' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required when creating a new connection' },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const existingConnection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (existingConnection) {
      return NextResponse.json(
        { error: 'Connection already exists. Use PUT to update.' },
        { status: 409 }
      );
    }

    // Encrypt password (reversible encryption, not hashing)
    const encryptedPassword = encryptPassword(password);

    // Create connection
    const connection = await prisma.cardDavConnection.create({
      data: {
        userId: session.user.id,
        serverUrl,
        username,
        password: encryptedPassword,
        provider: provider || null,
        syncEnabled: syncEnabled ?? true,
        autoExportNew: autoExportNew ?? true,
        autoSyncInterval: autoSyncInterval ?? 43200, // Default: 12 hours
        importMode: importMode ?? 'manual', // Default: manual
        addressBookUrl: addressBookUrl || null,
        addressBookName: addressBookName || null,
        cardDavNameFormat: cardDavNameFormat ?? 'FULL',
      },
    });

    // Return connection without password
    const { password: _, ...safeConnection } = connection;

    return NextResponse.json(safeConnection, { status: 201 });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error creating CardDAV connection');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const PUT = withLogging(async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = updateConnectionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const {
      serverUrl,
      username,
      password,
      provider,
      syncEnabled,
      autoExportNew,
      autoSyncInterval,
      importMode,
      cardDavNameFormat,
    } = validationResult.data;

    // Validate URL to prevent SSRF attacks if serverUrl is being updated
    if (serverUrl) {
      try {
        await validateServerUrl(serverUrl);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid server URL' },
          { status: 400 }
        );
      }
    }

    // Check if connection exists
    const existingConnection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!existingConnection) {
      return NextResponse.json(
        { error: 'Connection not found. Use POST to create.' },
        { status: 404 }
      );
    }

    // Prepare update data - only include fields that were provided
    const updateData: {
      serverUrl?: string;
      username?: string;
      password?: string;
      provider?: string | null;
      syncEnabled?: boolean;
      autoExportNew?: boolean;
      autoSyncInterval?: number;
      importMode?: string;
      cardDavNameFormat?: 'FULL' | 'FIRST_LAST' | 'NICKNAME_PREFERRED' | 'SHORT';
    } = {};

    if (serverUrl !== undefined) {
      updateData.serverUrl = serverUrl;
    }
    if (username !== undefined) {
      updateData.username = username;
    }
    if (password) {
      updateData.password = encryptPassword(password);
    }
    if (provider !== undefined) {
      updateData.provider = provider || null;
    }
    if (syncEnabled !== undefined) {
      updateData.syncEnabled = syncEnabled;
    }
    if (autoExportNew !== undefined) {
      updateData.autoExportNew = autoExportNew;
    }
    if (autoSyncInterval !== undefined) {
      updateData.autoSyncInterval = autoSyncInterval;
    }
    if (importMode !== undefined) {
      updateData.importMode = importMode;
    }
    if (cardDavNameFormat !== undefined) {
      updateData.cardDavNameFormat = cardDavNameFormat;
    }

    // Update connection
    const connection = await prisma.cardDavConnection.update({
      where: { userId: session.user.id },
      data: updateData,
    });

    // When the name format changes, mark all synced mappings as pending
    // so the next sync re-exports them with the updated FN field.
    if (
      cardDavNameFormat !== undefined &&
      cardDavNameFormat !== existingConnection.cardDavNameFormat
    ) {
      await prisma.cardDavMapping.updateMany({
        where: {
          connectionId: existingConnection.id,
          syncStatus: 'synced',
        },
        data: {
          syncStatus: 'pending',
          lastLocalChange: new Date(),
        },
      });
    }

    // Return connection without password
    const { password: _, ...safeConnection } = connection;

    return NextResponse.json(safeConnection);
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error updating CardDAV connection');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const DELETE = withLogging(async function DELETE(_request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if connection exists
    const existingConnection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!existingConnection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Delete all related data and the connection in a single transaction
    await prisma.$transaction([
      // Delete mappings (cascade will handle related conflicts)
      prisma.cardDavMapping.deleteMany({
        where: { connectionId: existingConnection.id },
      }),
      // Delete pending imports
      prisma.cardDavPendingImport.deleteMany({
        where: { connectionId: existingConnection.id },
      }),
      // Delete the connection
      prisma.cardDavConnection.delete({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error deleting CardDAV connection');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
