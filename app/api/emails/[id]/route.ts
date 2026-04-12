import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';

// GET /api/emails/[id] - Get single email with full body and linked persons
export const GET = withLogging(async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const email = await prisma.emailLog.findUnique({
      where: { id },
      include: {
        integration: {
          select: { userId: true },
        },
        people: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                surname: true,
                photo: true,
              },
            },
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            driveWebViewUrl: true,
          },
        },
      },
    });

    if (!email || email.integration.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...email,
        date: email.date.toISOString(),
        createdAt: email.createdAt.toISOString(),
        integration: undefined, // Strip internal data
        persons: email.people.map((p) => ({
          id: p.person.id,
          name: p.person.name,
          surname: p.person.surname,
          photo: p.person.photo,
          role: p.role,
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, 'email-detail');
  }
});
