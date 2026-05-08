import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createJournalEntrySchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';

const ITEMS_PER_PAGE = 50;

// GET /api/journal - List journal entries for the current user
export const GET = withAuth(async (request, session) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const personId = url.searchParams.get('person');
    const search = url.searchParams.get('q');

    const where: Prisma.JournalEntryWhereInput = {
      userId: session.user.id,
      deletedAt: null,
      ...(personId && {
        people: { some: { personId } },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { body: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [entries, totalCount] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          people: {
            where: { person: { deletedAt: null } },
            include: {
              person: {
                select: {
                  id: true,
                  name: true,
                  surname: true,
                  nickname: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * ITEMS_PER_PAGE,
        take: ITEMS_PER_PAGE,
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return apiResponse.ok({
      entries,
      pagination: {
        page,
        pageSize: ITEMS_PER_PAGE,
        totalCount,
        totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
      },
    });
  } catch (error) {
    return handleApiError(error, 'journal-list');
  }
});

// POST /api/journal - Create a new journal entry
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createJournalEntrySchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { title, date, hasTime, body: entryBody, personIds, updateLastContact } = validation.data;

    // Validate personIds belong to the current user
    if (personIds && personIds.length > 0) {
      const validCount = await prisma.person.count({
        where: { id: { in: personIds }, userId: session.user.id, deletedAt: null },
      });
      if (validCount !== personIds.length) {
        return apiResponse.error('One or more person IDs are invalid');
      }
    }

    const sanitizedTitle = sanitizeName(title) || title;
    const sanitizedBody = sanitizeNotes(entryBody) || entryBody;
    const entryDate = hasTime
      ? new Date(date)
      : new Date(`${date.slice(0, 10)}T00:00:00.000Z`);

    const entry = await prisma.journalEntry.create({
      data: {
        userId: session.user.id,
        title: sanitizedTitle,
        date: entryDate,
        hasTime,
        body: sanitizedBody,
        ...(personIds && personIds.length > 0 && {
          people: {
            create: personIds.map((personId) => ({
              person: { connect: { id: personId } },
            })),
          },
        }),
      },
      include: {
        people: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                surname: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    // Update lastContact for tagged people if requested
    if (updateLastContact && personIds && personIds.length > 0) {
      await prisma.person.updateMany({
        where: {
          id: { in: personIds },
          userId: session.user.id,
          OR: [
            { lastContact: null },
            { lastContact: { lt: entryDate } },
          ],
        },
        data: { lastContact: entryDate },
      });
    }

    return apiResponse.created({ entry });
  } catch (error) {
    return handleApiError(error, 'journal-create');
  }
});
