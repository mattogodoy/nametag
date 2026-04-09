import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';

// GET /api/people/[id]/emails - List email logs for a person
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
    const totalCount = await prisma.emailLogPerson.count({
      where: { personId },
    });

    // Query email logs through the join table
    const emailLogPeople = await prisma.emailLogPerson.findMany({
      where: { personId },
      include: {
        emailLog: {
          select: {
            id: true,
            subject: true,
            snippet: true,
            fromEmail: true,
            fromName: true,
            date: true,
            hasAttachments: true,
            isRead: true,
          },
        },
      },
      orderBy: {
        emailLog: {
          date: 'desc',
        },
      },
      skip,
      take: pageSize,
    });

    // Flatten the results to return email log data directly
    const emails = emailLogPeople.map((elp) => ({
      id: elp.emailLog.id,
      role: elp.role,
      subject: elp.emailLog.subject,
      snippet: elp.emailLog.snippet,
      fromEmail: elp.emailLog.fromEmail,
      fromName: elp.emailLog.fromName,
      date: elp.emailLog.date,
      hasAttachments: elp.emailLog.hasAttachments,
      isRead: elp.emailLog.isRead,
    }));

    return NextResponse.json({
      success: true,
      data: emails,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    return handleApiError(error, 'people-emails-get');
  }
});
