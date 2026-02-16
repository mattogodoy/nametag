import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { encryptPassword } from '@/lib/carddav/encryption';
import { z } from 'zod';

const connectionSchema = z.object({
  serverUrl: z.string().url().min(1),
  username: z.string().min(1),
  password: z.string().optional(),
  provider: z.string().nullable().optional(),
  syncEnabled: z.boolean().optional(),
  autoExportNew: z.boolean().optional(),
  autoSyncInterval: z.number().int().min(60).max(86400).optional(), // 1 min to 24 hours
  importMode: z.enum(['manual', 'notify', 'auto']).optional(),
});

export async function POST(request: Request) {
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
    } = validationResult.data;

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
      },
    });

    // Return connection without password
    const { password: _, ...safeConnection } = connection;

    return NextResponse.json(safeConnection, { status: 201 });
  } catch (error) {
    console.error('Error creating CardDAV connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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
    } = validationResult.data;

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

    // Prepare update data
    const updateData: {
      serverUrl: string;
      username: string;
      password?: string;
      provider: string | null;
      syncEnabled?: boolean;
      autoExportNew?: boolean;
      autoSyncInterval?: number;
      importMode?: string;
    } = {
      serverUrl,
      username,
      provider: provider || null,
    };

    // Only update password if provided
    if (password) {
      updateData.password = encryptPassword(password);
    }

    // Update sync settings if provided
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

    // Update connection
    const connection = await prisma.cardDavConnection.update({
      where: { userId: session.user.id },
      data: updateData,
    });

    // Return connection without password
    const { password: _, ...safeConnection } = connection;

    return NextResponse.json(safeConnection);
  } catch (error) {
    console.error('Error updating CardDAV connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request) {
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

    // Delete all related data first
    // Delete mappings (cascade will handle related conflicts)
    await prisma.cardDavMapping.deleteMany({
      where: { connectionId: existingConnection.id },
    });

    // Delete pending imports
    await prisma.cardDavPendingImport.deleteMany({
      where: { connectionId: existingConnection.id },
    });

    // Delete the connection
    await prisma.cardDavConnection.delete({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting CardDAV connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
