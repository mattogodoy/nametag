import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, withLogging } from '@/lib/api-utils';

const PAGE_SIZE = 30;

// GET /api/emails - List synced emails with person labels, search, and pagination
export const GET = withLogging(async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const search = url.searchParams.get('q')?.trim() || '';
    const personId = url.searchParams.get('personId') || '';
    const filter = url.searchParams.get('filter') || 'all'; // all, unread, attachments
    const skip = (page - 1) * PAGE_SIZE;

    // Get user's integration
    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, pageSize: PAGE_SIZE, totalCount: 0, totalPages: 0 },
      });
    }

    // Build where clause
    const where: Record<string, unknown> = {
      integrationId: integration.id,
    };

    // Search filter
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { fromName: { contains: search, mode: 'insensitive' } },
        { fromEmail: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by person
    if (personId) {
      where.people = {
        some: { personId },
      };
    }

    // Filter by status
    if (filter === 'unread') {
      where.isRead = false;
    } else if (filter === 'attachments') {
      where.hasAttachments = true;
    }

    // Count + fetch in parallel
    const [totalCount, emails] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        select: {
          id: true,
          gmailMessageId: true,
          gmailThreadId: true,
          subject: true,
          snippet: true,
          fromEmail: true,
          fromName: true,
          toEmails: true,
          date: true,
          hasAttachments: true,
          isRead: true,
          labelIds: true,
          people: {
            select: {
              role: true,
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
        },
        orderBy: { date: 'desc' },
        skip,
        take: PAGE_SIZE,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // Transform dates to ISO strings for client
    const data = emails.map((email) => ({
      ...email,
      date: email.date.toISOString(),
      persons: email.people.map((p) => ({
        id: p.person.id,
        name: p.person.name,
        surname: p.person.surname,
        photo: p.person.photo,
        role: p.role,
      })),
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, pageSize: PAGE_SIZE, totalCount, totalPages },
    });
  } catch (error) {
    return handleApiError(error, 'emails-list');
  }
});
