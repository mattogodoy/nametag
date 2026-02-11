import { prisma } from '@/lib/prisma';
import { createPersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { canCreateResource, canEnableReminder } from '@/lib/billing';
import { autoExportPerson } from '@/lib/carddav/auto-export';

// GET /api/people - List all people for the current user
export const GET = withAuth(async (request, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';
    const groupIdsParam = searchParams.get('groupIds');

    // Build where clause
    const where: { userId: string; groups?: { some: { groupId: { in: string[] } } } } = {
      userId: session.user.id,
    };

    // Filter by groups if specified
    if (groupIdsParam) {
      const groupIds = groupIdsParam.split(',').filter(Boolean);
      if (groupIds.length > 0) {
        where.groups = {
          some: {
            groupId: {
              in: groupIds,
            },
          },
        };
      }
    }

    const people = await prisma.person.findMany({
      where,
      include: {
        relationshipToUser: true,
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
        // Include these additional fields when includeAll=true (for export)
        ...(includeAll && {
          importantDates: {
            where: {
              deletedAt: null,
            },
            orderBy: {
              date: 'asc',
            },
          },
          relationshipsFrom: {
            where: {
              deletedAt: null,
            },
            include: {
              relatedPerson: true,
            },
          },
        }),
      },
      orderBy: {
        name: 'asc',
      },
    });

    return apiResponse.ok({ people });
  } catch (error) {
    return handleApiError(error, 'people-list');
  }
});

// POST /api/people - Create a new person
export const POST = withAuth(async (request, session) => {
  try {
    // Check if user has reached their plan limit for people
    const usageCheck = await canCreateResource(session.user.id, 'people');
    if (!usageCheck.allowed) {
      return apiResponse.forbidden(
        `You've reached your plan limit of ${usageCheck.limit} people. ` +
        `Please upgrade your plan to add more.`
      );
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(createPersonSchema, body);

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
      connectedThroughId,
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

    // Relationship type is always required when creating a person
    if (!relationshipToUserId) {
      if (connectedThroughId) {
        return apiResponse.error('Relationship type is required for person-to-person connections');
      } else {
        return apiResponse.error('Relationship to user is required');
      }
    }

    // If connectedThroughId is provided, verify the person exists and belongs to user
    if (connectedThroughId) {
      const basePerson = await prisma.person.findUnique({
        where: { id: connectedThroughId, userId: session.user.id },
      });

      if (!basePerson) {
        return apiResponse.notFound('Base connection person not found');
      }
    }

    // Check reminder limits if any reminders are being enabled
    const newRemindersCount =
      (contactReminderEnabled ? 1 : 0) +
      (importantDates?.filter((d) => d.reminderEnabled).length ?? 0);

    if (newRemindersCount > 0) {
      const reminderCheck = await canEnableReminder(session.user.id);
      if (!reminderCheck.isUnlimited) {
        const remainingSlots = reminderCheck.limit - reminderCheck.current;
        if (newRemindersCount > remainingSlots) {
          return apiResponse.forbidden(
            `You can only add ${remainingSlots} more reminder(s) on your current plan ` +
            `(limit: ${reminderCheck.limit}). Please upgrade your plan to add more.`
          );
        }
      }
    }

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedName = sanitizeName(name) || name; // Fallback to original if sanitization fails
    const sanitizedSurname = surname ? sanitizeName(surname) : null;
    const sanitizedMiddleName = middleName ? sanitizeName(middleName) : null;
    const sanitizedSecondLastName = secondLastName ? sanitizeName(secondLastName) : null;
    const sanitizedNickname = nickname ? sanitizeName(nickname) : null;
    const sanitizedNotes = notes ? sanitizeNotes(notes) : null;

    // Create person data based on whether it's a direct or indirect connection
    const personData = {
      user: {
        connect: { id: session.user.id },
      },
      name: sanitizedName,
      surname: sanitizedSurname,
      middleName: sanitizedMiddleName,
      secondLastName: sanitizedSecondLastName,
      nickname: sanitizedNickname,

      // vCard identification fields
      prefix: prefix || null,
      suffix: suffix || null,
      uid: uid || null,

      // Professional fields
      organization: organization || null,
      jobTitle: jobTitle || null,

      // Other vCard fields
      photo: photo || null,
      gender: gender || null,
      anniversary: anniversary ? new Date(anniversary) : null,

      lastContact: lastContact ? new Date(lastContact) : null,
      notes: sanitizedNotes,
      contactReminderEnabled: contactReminderEnabled ?? false,
      contactReminderInterval: contactReminderEnabled ? contactReminderInterval : null,
      contactReminderIntervalUnit: contactReminderEnabled ? contactReminderIntervalUnit : null,
      groups: groupIds
        ? {
            create: groupIds.map((groupId) => ({
              groupId,
            })),
          }
        : undefined,
      importantDates: importantDates && importantDates.length > 0
        ? {
            create: importantDates.map((date) => {
              // If yearUnknown is true, set the year to 1604 (Apple's convention)
              const dateValue = date.yearUnknown
                ? (() => {
                    const d = new Date(date.date);
                    d.setFullYear(1604);
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
          }
        : undefined,
      // Multi-value vCard fields
      phoneNumbers: phoneNumbers && phoneNumbers.length > 0
        ? {
            create: phoneNumbers.map((phone) => ({
              type: phone.type,
              number: phone.number,
            })),
          }
        : undefined,
      emails: emails && emails.length > 0
        ? {
            create: emails.map((email) => ({
              type: email.type,
              email: email.email,
            })),
          }
        : undefined,
      addresses: addresses && addresses.length > 0
        ? {
            create: addresses.map((addr) => ({
              type: addr.type,
              streetLine1: addr.streetLine1 || null,
              streetLine2: addr.streetLine2 || null,
              locality: addr.locality || null,
              region: addr.region || null,
              postalCode: addr.postalCode || null,
              country: addr.country || null,
            })),
          }
        : undefined,
      urls: urls && urls.length > 0
        ? {
            create: urls.map((url) => ({
              type: url.type,
              url: url.url,
            })),
          }
        : undefined,
      imHandles: imHandles && imHandles.length > 0
        ? {
            create: imHandles.map((im) => ({
              protocol: im.protocol,
              handle: im.handle,
            })),
          }
        : undefined,
      locations: locations && locations.length > 0
        ? {
            create: locations.map((loc) => ({
              type: loc.type,
              latitude: loc.latitude,
              longitude: loc.longitude,
            })),
          }
        : undefined,
      customFields: customFields && customFields.length > 0
        ? {
            create: customFields.map((field) => ({
              key: field.key,
              value: field.value,
              type: field.type || null,
            })),
          }
        : undefined,
      // Only add relationshipToUser if NOT connected through another person
      relationshipToUser: !connectedThroughId && relationshipToUserId
        ? { connect: { id: relationshipToUserId } }
        : undefined,
    };

    const person = await prisma.person.create({
      data: personData,
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    // If connected through another person, create bidirectional relationship
    if (connectedThroughId) {
      // Find the relationshipType and its inverse
      const relationshipType = await prisma.relationshipType.findUnique({
        where: { id: relationshipToUserId },
        select: { inverseId: true },
      });

      // Create primary relationship (new person -> base person)
      await prisma.relationship.create({
        data: {
          personId: person.id,
          relatedPersonId: connectedThroughId,
          relationshipTypeId: relationshipToUserId,
        },
      });

      // Always create inverse relationship (base person -> new person)
      // Use the inverse type if it exists, otherwise use the same type
      await prisma.relationship.create({
        data: {
          personId: connectedThroughId,
          relatedPersonId: person.id,
          relationshipTypeId: relationshipType?.inverseId || relationshipToUserId,
        },
      });
    }

    // Auto-export to CardDAV if enabled (don't await - let it run in background)
    autoExportPerson(person.id).catch((error) => {
      console.error('Auto-export failed:', error);
      // Don't fail the request if auto-export fails
    });

    return apiResponse.created({ person });
  } catch (error) {
    return handleApiError(error, 'people-create');
  }
});
