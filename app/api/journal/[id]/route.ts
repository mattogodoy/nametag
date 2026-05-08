import { prisma } from '@/lib/prisma';
import { updateJournalEntrySchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';

// GET /api/journal/[id] - Get a single journal entry
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const entry = await prisma.journalEntry.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
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
    });

    if (!entry) {
      return apiResponse.notFound('Journal entry not found');
    }

    return apiResponse.ok({ entry });
  } catch (error) {
    return handleApiError(error, 'journal-get');
  }
});

// PUT /api/journal/[id] - Update a journal entry
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    const body = await parseRequestBody(request);
    const validation = validateRequest(updateJournalEntrySchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { title, date, hasTime, body: entryBody, personIds, updateLastContact } = validation.data;

    const existingEntry = await prisma.journalEntry.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existingEntry) {
      return apiResponse.notFound('Journal entry not found');
    }

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

    // Remove existing people associations and recreate atomically
    const entry = await prisma.$transaction(async (tx) => {
      await tx.journalEntryPerson.deleteMany({
        where: { journalEntryId: id },
      });

      return tx.journalEntry.update({
        where: { id },
        data: {
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
      });
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

    return apiResponse.ok({ entry });
  } catch (error) {
    return handleApiError(error, 'journal-update');
  }
});

// DELETE /api/journal/[id] - Soft delete a journal entry
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const existingEntry = await prisma.journalEntry.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existingEntry) {
      return apiResponse.notFound('Journal entry not found');
    }

    await prisma.journalEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return apiResponse.message('Journal entry deleted successfully');
  } catch (error) {
    return handleApiError(error, 'journal-delete');
  }
});
