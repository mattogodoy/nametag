import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { processDocumentOcr } from '@/lib/google/ocr';

// POST /api/documents/[id]/ocr - Re-trigger OCR for a document
export const POST = withLogging(async function POST(
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

    // Reset OCR status to pending so it can be re-processed
    await prisma.document.update({
      where: { id: documentId },
      data: { ocrStatus: 'pending', ocrText: null, metadata: undefined },
    });

    // Process OCR
    await processDocumentOcr(session.user.id, documentId);

    // Fetch the updated document
    const updatedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        ocrStatus: true,
        ocrText: true,
        metadata: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updatedDocument });
  } catch (error) {
    return handleApiError(error, 'documents-ocr-post');
  }
});
