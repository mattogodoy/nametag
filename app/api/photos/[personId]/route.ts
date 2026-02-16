import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-utils';
import { isPhotoFilename, readPhotoFile } from '@/lib/photo-storage';

interface RouteParams {
  params: Promise<{
    personId: string;
  }>;
}

// GET /api/photos/[personId] - Serve a person's photo from disk
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { personId } = await (context as RouteParams).params;

    // Get person and verify ownership
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        userId: session.user.id,
      },
      select: { photo: true },
    });

    if (!person || !person.photo) {
      return new NextResponse(null, { status: 404 });
    }

    // Only serve file-based photos through this endpoint
    if (!isPhotoFilename(person.photo)) {
      return new NextResponse(null, { status: 404 });
    }

    const result = await readPhotoFile(session.user.id, person.photo);
    if (!result) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Length': String(result.buffer.length),
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
});
