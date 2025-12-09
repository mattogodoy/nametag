import { prisma } from '@/lib/prisma';
import { updatePersonSchema, deletePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { Prisma } from '@prisma/client';

// GET /api/people/[id] - Get a single person
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        relationshipToUser: true,
        groups: {
          include: {
            group: true,
          },
        },
        relationshipsFrom: {
          include: {
            relatedPerson: true,
          },
        },
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    return apiResponse.ok({ person });
  } catch (error) {
    return handleApiError(error, 'people-get');
  }
});

// PUT /api/people/[id] - Update a person
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;

    const body = await parseRequestBody(request);
    const validation = validateRequest(updatePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      surname,
      nickname,
      lastContact,
      notes,
      relationshipToUserId,
      groupIds,
      importantDates,
      contactReminderEnabled,
      contactReminderInterval,
      contactReminderIntervalUnit,
    } = validation.data;

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingPerson) {
      return apiResponse.notFound('Person not found');
    }

    // Relationship is not required for people with indirect connections
    // (they are connected through other people in the network)

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedName = sanitizeName(name) || name;
    const sanitizedSurname = surname ? sanitizeName(surname) : null;
    const sanitizedNickname = nickname ? sanitizeName(nickname) : null;
    const sanitizedNotes = notes ? sanitizeNotes(notes) : null;

    // Build update data
    const updateData: Prisma.PersonUpdateInput = {
      name: sanitizedName,
      surname: sanitizedSurname,
      nickname: sanitizedNickname,
      lastContact: lastContact ? new Date(lastContact) : null,
      notes: sanitizedNotes,
      contactReminderEnabled: contactReminderEnabled ?? false,
      contactReminderInterval: contactReminderEnabled ? contactReminderInterval : null,
      contactReminderIntervalUnit: contactReminderEnabled ? contactReminderIntervalUnit : null,
      groups: groupIds
        ? {
            deleteMany: {},
            create: groupIds.map((groupId) => ({
              groupId,
            })),
          }
        : undefined,
      importantDates: importantDates
        ? {
            deleteMany: {},
            create: importantDates.map((date) => ({
              title: date.title,
              date: new Date(date.date),
              reminderEnabled: date.reminderEnabled ?? false,
              reminderType: date.reminderEnabled ? date.reminderType : null,
              reminderInterval: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderInterval : null,
              reminderIntervalUnit: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderIntervalUnit : null,
            })),
          }
        : undefined,
      // Only update relationshipToUserId if it's provided
      relationshipToUser: relationshipToUserId
        ? { connect: { id: relationshipToUserId } }
        : undefined,
    };

    // Update person and handle group associations
    const person = await prisma.person.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    return apiResponse.ok({ person });
  } catch (error) {
    return handleApiError(error, 'people-update');
  }
});

// DELETE /api/people/[id] - Delete a person
export const DELETE = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingPerson) {
      return apiResponse.notFound('Person not found');
    }

    // Parse request body to check if we should also delete orphans
    const body = await parseRequestBody(request).catch(() => ({}));
    const validation = validateRequest(deletePersonSchema, body);

    // Use validated data, or defaults if body was empty/invalid
    const { deleteOrphans, orphanIds } = validation.success
      ? validation.data
      : { deleteOrphans: false, orphanIds: [] };

    // Delete the person
    await prisma.person.delete({
      where: {
        id,
      },
    });

    // If requested, also delete the orphans
    if (deleteOrphans && orphanIds && Array.isArray(orphanIds)) {
      await prisma.person.deleteMany({
        where: {
          id: {
            in: orphanIds,
          },
          userId: session.user.id, // Ensure they belong to the user
        },
      });
    }

    return apiResponse.message('Person deleted successfully');
  } catch (error) {
    return handleApiError(error, 'people-delete');
  }
});
