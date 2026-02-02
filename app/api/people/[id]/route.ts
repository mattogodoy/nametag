import { prisma } from '@/lib/prisma';
import { updatePersonSchema, deletePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { canEnableReminder } from '@/lib/billing';
import { autoUpdatePerson } from '@/lib/carddav/auto-export';
import { deleteFromCardDav as deleteContactFromCardDav } from '@/lib/carddav/delete-contact';

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
        phoneNumbers: true,
        emails: true,
        addresses: true,
        urls: true,
        imHandles: true,
        locations: true,
        customFields: true,
        importantDates: true,
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
      prefix,
      suffix,
      uid,
      organization,
      jobTitle,
      photo,
      gender,
      anniversary,
      lastContact,
      notes,
      relationshipToUserId,
      groupIds,
      importantDates,
      contactReminderEnabled,
      contactReminderInterval,
      contactReminderIntervalUnit,
      phoneNumbers,
      emails,
      addresses,
      urls,
      imHandles,
      locations,
      customFields,
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

    // Build update data (only include fields that were provided)
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = sanitizedName;
    if (surname !== undefined) updateData.surname = sanitizedSurname;
    if (middleName !== undefined) updateData.middleName = sanitizedMiddleName;
    if (secondLastName !== undefined) updateData.secondLastName = sanitizedSecondLastName;
    if (nickname !== undefined) updateData.nickname = sanitizedNickname;

    // vCard identification fields
    if (prefix !== undefined) updateData.prefix = prefix || null;
    if (suffix !== undefined) updateData.suffix = suffix || null;
    if (uid !== undefined) updateData.uid = uid || null;

    // Professional fields
    if (organization !== undefined) updateData.organization = organization || null;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle || null;

    // Other vCard fields
    if (photo !== undefined) updateData.photo = photo || null;
    if (gender !== undefined) updateData.gender = gender || null;
    if (anniversary !== undefined) updateData.anniversary = anniversary ? new Date(anniversary) : null;

    if (lastContact !== undefined) updateData.lastContact = lastContact ? new Date(lastContact) : null;
    if (notes !== undefined) updateData.notes = sanitizedNotes;
    if (contactReminderEnabled !== undefined) {
      updateData.contactReminderEnabled = contactReminderEnabled;
      updateData.contactReminderInterval = contactReminderEnabled ? contactReminderInterval : null;
      updateData.contactReminderIntervalUnit = contactReminderEnabled ? contactReminderIntervalUnit : null;
    }

    // Groups (deleteMany + create pattern)
    if (groupIds !== undefined) {
      updateData.groups = {
        deleteMany: {},
        create: groupIds.map((groupId) => ({
          groupId,
        })),
      };
    }

    // Important dates (deleteMany + create pattern)
    if (importantDates !== undefined) {
      updateData.importantDates = {
        deleteMany: {},
        create: importantDates.map((date) => {
          // If yearUnknown is true, set the year to 1900
          const dateValue = date.yearUnknown
            ? (() => {
                const d = new Date(date.date);
                d.setFullYear(1900);
                return d;
              })()
            : new Date(date.date);

          return {
            title: date.title,
            date: dateValue,
            reminderEnabled: date.reminderEnabled ?? false,
            reminderType: date.reminderEnabled ? date.reminderType : null,
            reminderInterval: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderInterval : null,
            reminderIntervalUnit: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderIntervalUnit : null,
          };
        }),
      };
    }

    // Multi-value vCard fields (deleteMany + create pattern)
    if (phoneNumbers !== undefined) {
      updateData.phoneNumbers = {
        deleteMany: {},
        create: phoneNumbers.map((phone) => ({
          type: phone.type,
          number: phone.number,
        })),
      };
    }

    if (emails !== undefined) {
      updateData.emails = {
        deleteMany: {},
        create: emails.map((email) => ({
          type: email.type,
          email: email.email,
        })),
      };
    }

    if (addresses !== undefined) {
      updateData.addresses = {
        deleteMany: {},
        create: addresses.map((addr) => ({
          type: addr.type,
          streetLine1: addr.streetLine1 || null,
          streetLine2: addr.streetLine2 || null,
          locality: addr.locality || null,
          region: addr.region || null,
          postalCode: addr.postalCode || null,
          country: addr.country || null,
        })),
      };
    }

    if (urls !== undefined) {
      updateData.urls = {
        deleteMany: {},
        create: urls.map((url) => ({
          type: url.type,
          url: url.url,
        })),
      };
    }

    if (imHandles !== undefined) {
      updateData.imHandles = {
        deleteMany: {},
        create: imHandles.map((im) => ({
          protocol: im.protocol,
          handle: im.handle,
        })),
      };
    }

    if (locations !== undefined) {
      updateData.locations = {
        deleteMany: {},
        create: locations.map((loc) => ({
          type: loc.type,
          latitude: loc.latitude,
          longitude: loc.longitude,
        })),
      };
    }

    if (customFields !== undefined) {
      updateData.customFields = {
        deleteMany: {},
        create: customFields.map((field) => ({
          key: field.key,
          value: field.value,
          type: field.type || null,
        })),
      };
    }

    // Only update relationshipToUserId if it's provided
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
        phoneNumbers: true,
        emails: true,
        addresses: true,
        urls: true,
        imHandles: true,
        locations: true,
        customFields: true,
        importantDates: true,
      },
    });

    // Auto-update on CardDAV if enabled (don't await - let it run in background)
    autoUpdatePerson(person.id).catch((error) => {
      console.error('Auto-update failed:', error);
      // Don't fail the request if auto-update fails
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
    const { deleteOrphans, orphanIds, deleteFromCardDav } = validation.success
      ? validation.data
      : { deleteOrphans: false, orphanIds: [], deleteFromCardDav: false };

    // If requested, delete from CardDAV server (do this before soft-deleting)
    if (deleteFromCardDav) {
      await deleteContactFromCardDav(id).catch((error) => {
        console.error('Failed to delete from CardDAV server:', error);
        // Continue with local deletion even if CardDAV delete fails
      });
    }

    // Always delete the CardDAV mapping when deleting a person
    // This allows re-importing the contact if it still exists on the server
    await prisma.cardDavMapping.deleteMany({
      where: {
        personId: id,
      },
    });

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
