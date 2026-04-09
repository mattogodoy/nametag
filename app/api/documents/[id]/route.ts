import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { getGoogleAuth } from '@/lib/google/auth';
import { deleteFileFromDrive } from '@/lib/google/drive';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('documents-api');

// GET /api/documents/[id] - Get single document details
export const GET = withLogging(async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: documentId } = await context.params;

    // Fetch document with ownership verification through integration -> user chain
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        integration: {
          select: { userId: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.integration.userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Return document details (excluding integration relation)
    const { integration: _, ...documentData } = document;

    return NextResponse.json({ success: true, data: documentData });
  } catch (error) {
    return handleApiError(error, 'documents-get');
  }
});

// DELETE /api/documents/[id] - Delete a document
export const DELETE = withLogging(async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: documentId } = await context.params;

    // Fetch document with ownership verification
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        integration: {
          select: { userId: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (document.integration.userId !== session.user.id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from Google Drive
    try {
      const { auth: googleAuth } = await getGoogleAuth(session.user.id);
      const drive = google.drive({ version: 'v3', auth: googleAuth });
      await deleteFileFromDrive(drive, document.driveFileId);
    } catch (driveError) {
      // Log but continue with DB deletion even if Drive deletion fails
      // (file may have been manually deleted from Drive)
      log.warn(
        { documentId, driveFileId: document.driveFileId, error: driveError instanceof Error ? driveError.message : String(driveError) },
        'Failed to delete file from Google Drive, continuing with DB deletion',
      );
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    log.info({ userId: session.user.id, documentId }, 'Document deleted');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'documents-delete');
  }
});
