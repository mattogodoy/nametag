import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { uploadDocumentForPerson } from '@/lib/google/sync';

// GET /api/people/[id]/documents - List documents for a person
export const GET = withLogging(async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: personId } = await context.params;

    // Verify person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: { id: personId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Parse pagination params
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const skip = (page - 1) * pageSize;

    // Get total count
    const totalCount = await prisma.document.count({
      where: { personId },
    });

    // Query documents
    const documents = await prisma.document.findMany({
      where: { personId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        source: true,
        driveWebViewUrl: true,
        ocrStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    });

    return NextResponse.json({
      success: true,
      data: documents,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error, 'people-documents-get');
  }
});

// POST /api/people/[id]/documents - Upload a document for a person
export const POST = withLogging(async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: personId } = await context.params;

    // Verify person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: { id: personId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Verify Google integration exists with Drive enabled
    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'No Google integration found. Connect Google first.' },
        { status: 404 },
      );
    }

    if (!integration.driveSyncEnabled) {
      return NextResponse.json(
        { error: 'Google Drive sync is not enabled.' },
        { status: 400 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Include a "file" field in the form data.' },
        { status: 400 },
      );
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name || 'upload';
    const mimeType = file.type || 'application/octet-stream';

    // Upload to Drive and create document record
    const result = await uploadDocumentForPerson(
      session.user.id,
      personId,
      fileName,
      mimeType,
      buffer,
    );

    // Fetch the created document to return full details
    const document = await prisma.document.findUnique({
      where: { id: result.documentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        source: true,
        driveWebViewUrl: true,
        ocrStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'people-documents-post');
  }
});
