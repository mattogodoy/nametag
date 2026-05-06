import { prisma } from '@/lib/prisma';
import { createPersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canCreateResource, canEnableReminder } from '@/lib/billing';
import { savePhoto } from '@/lib/photo-storage';
import { createPerson } from '@/lib/services/person';
import { applyCustomFieldValues, validateCustomFieldValues, CustomFieldValidationError } from '@/lib/customFields/persistence';

// GET /api/people - List all people for the current user
export const GET = withAuth(async (request, session) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';
    const groupIdsParam = searchParams.get('groupIds');
    // When includeDetails=false, skip multi-value relations (phones, emails, etc.)
    // for lighter list-view responses. Defaults to true for backward compatibility.
    const includeDetails = searchParams.get('includeDetails') !== 'false';

    // Build where clause
    const where: { userId: string; deletedAt: null; groups?: { some: { groupId: { in: string[] } } } } = {
      userId: session.user.id,
      deletedAt: null,
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
          where: { group: { deletedAt: null } },
          include: {
            group: true,
          },
        },
        // Multi-value relations are conditionally included.
        // Pass ?includeDetails=false for lightweight list views.
        ...(includeDetails && {
          phoneNumbers: true,
          emails: true,
          addresses: true,
          urls: true,
          imHandles: true,
          locations: true,
          customFields: true,
        }),
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
          customFieldValues: {
            include: { template: true },
            where: { template: { deletedAt: null } },
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
      photo,
      relationshipToUserId,
      connectedThroughId,
      importantDates,
      contactReminderEnabled,
      cardDavSyncEnabled: _cardDavSyncEnabled,
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
        where: { id: connectedThroughId, userId: session.user.id, deletedAt: null },
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

    // Validate customFieldValues BEFORE creating the person so that a validation error
    // does not leave a half-created person or a stale CardDAV export in flight.
    if (validation.data.customFieldValues !== undefined) {
      try {
        await validateCustomFieldValues(prisma, session.user.id, validation.data.customFieldValues);
      } catch (err) {
        if (err instanceof CustomFieldValidationError) {
          return apiResponse.error(err.message);
        }
        throw err;
      }
    }

    // Create person via service (handles sanitisation, nested writes, CardDAV auto-export).
    // When connected through another person, omit relationshipToUserId so the service
    // does not create a direct user relationship — that link is established below via
    // bidirectional Relationship records instead.
    const serviceData = connectedThroughId
      ? { ...validation.data, relationshipToUserId: null }
      : validation.data;

    const person = await createPerson(session.user.id, serviceData);

    // Save photo as file if it's a data URI or URL (must happen after creation for person ID)
    if (photo && (photo.startsWith('data:') || photo.startsWith('http://') || photo.startsWith('https://'))) {
      const photoFilename = await savePhoto(session.user.id, person.id, photo);
      if (photoFilename) {
        await prisma.person.update({
          where: { id: person.id },
          data: { photo: photoFilename },
        });
        (person as Record<string, unknown>).photo = photoFilename;
      }
    }

    // Apply custom field values if provided (undefined = no-op, [] = clear all).
    // Validation already passed above, so this step only performs the DB writes.
    if (validation.data.customFieldValues !== undefined) {
      await applyCustomFieldValues(prisma, session.user.id, person.id, validation.data.customFieldValues);
    }

    // If connected through another person, create bidirectional relationship
    if (connectedThroughId) {
      // Find the relationshipType and its inverse
      const relationshipType = await prisma.relationshipType.findUnique({
        where: { id: relationshipToUserId, deletedAt: null },
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

    return apiResponse.created({ person });
  } catch (error) {
    return handleApiError(error, 'people-create');
  }
});
