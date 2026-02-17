import { prisma } from '@/lib/prisma';
import { updatePersonSchema, deletePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { canEnableReminder } from '@/lib/billing';

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
      middleName,
      secondLastName,
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

    // Check reminder limits if adding new reminders
    // Get current reminders for this person
    const currentPersonReminders = await prisma.importantDate.count({
      where: { personId: id, reminderEnabled: true },
    });
    const currentContactReminder = existingPerson.contactReminderEnabled ? 1 : 0;

    // Calculate new reminders after update
    const newContactReminder = contactReminderEnabled ? 1 : 0;
    const newImportantDateReminders = importantDates?.filter((d) => d.reminderEnabled).length ?? 0;

    // Net change in reminders for this person
    const currentTotal = currentPersonReminders + currentContactReminder;
    const newTotal = newImportantDateReminders + newContactReminder;
    const netChange = newTotal - currentTotal;

    if (netChange > 0) {
      const reminderCheck = await canEnableReminder(session.user.id);
      if (!reminderCheck.isUnlimited) {
        const remainingSlots = reminderCheck.limit - reminderCheck.current;
        if (netChange > remainingSlots) {
          return apiResponse.forbidden(
            `You can only add ${remainingSlots} more reminder(s) on your current plan ` +
            `(limit: ${reminderCheck.limit}). Please upgrade your plan to add more.`
          );
        }
      }
    }

    // Relationship is not required for people with indirect connections
    // (they are connected through other people in the network)

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedName = sanitizeName(name) || name;
    const sanitizedSurname = surname ? sanitizeName(surname) : null;
    const sanitizedMiddleName = middleName ? sanitizeName(middleName) : null;
    const sanitizedSecondLastName = secondLastName ? sanitizeName(secondLastName) : null;
    const sanitizedNickname = nickname ? sanitizeName(nickname) : null;
    const sanitizedNotes = notes ? sanitizeNotes(notes) : null;

    // Build update data - only include fields that were provided in the request
    const updateData: Parameters<typeof prisma.person.update>[0]['data'] = {};

    if (name !== undefined) {
      updateData.name = sanitizedName;
    }
    if (surname !== undefined) {
      updateData.surname = sanitizedSurname;
    }
    if (middleName !== undefined) {
      updateData.middleName = sanitizedMiddleName;
    }
    if (secondLastName !== undefined) {
      updateData.secondLastName = sanitizedSecondLastName;
    }
    if (nickname !== undefined) {
      updateData.nickname = sanitizedNickname;
    }
    if (lastContact !== undefined) {
      updateData.lastContact = lastContact ? new Date(lastContact) : null;
    }
    if (notes !== undefined) {
      updateData.notes = sanitizedNotes;
    }
    if (contactReminderEnabled !== undefined) {
      updateData.contactReminderEnabled = contactReminderEnabled;
      updateData.contactReminderInterval = contactReminderEnabled ? contactReminderInterval : null;
      updateData.contactReminderIntervalUnit = contactReminderEnabled ? contactReminderIntervalUnit : null;
    }
    if (groupIds !== undefined) {
      updateData.groups = {
        deleteMany: {},
        create: groupIds.map((groupId) => ({
          groupId,
        })),
      };
    }
    if (importantDates !== undefined) {
      updateData.importantDates = {
        deleteMany: {},
        create: importantDates.map((date) => ({
          title: date.title,
          date: new Date(date.date),
          reminderEnabled: date.reminderEnabled ?? false,
          reminderType: date.reminderEnabled ? date.reminderType : null,
          reminderInterval: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderInterval : null,
          reminderIntervalUnit: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderIntervalUnit : null,
        })),
      };
    }
    if (relationshipToUserId !== undefined) {
      updateData.relationshipToUser = relationshipToUserId
        ? { connect: { id: relationshipToUserId } }
        : { disconnect: true };
    }

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

    // Soft delete the person (set deletedAt instead of removing)
    await prisma.person.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // If requested, also soft delete the orphans
    if (deleteOrphans && orphanIds && Array.isArray(orphanIds)) {
      await prisma.person.updateMany({
        where: {
          id: {
            in: orphanIds,
          },
          userId: session.user.id, // Ensure they belong to the user
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    return apiResponse.message('Person deleted successfully');
  } catch (error) {
    return handleApiError(error, 'people-delete');
  }
});
