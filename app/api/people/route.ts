import { prisma } from '@/lib/prisma';
import { createPersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { Prisma } from '@prisma/client';

// GET /api/people - List all people for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const people = await prisma.person.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        relationshipToUser: true,
        groups: {
          include: {
            group: true,
          },
        },
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
    const body = await request.json();
    const validation = validateRequest(createPersonSchema, body);

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
      connectedThroughId,
      importantDates,
      contactReminderEnabled,
      contactReminderInterval,
      contactReminderIntervalUnit,
    } = validation.data;

    // Relationship is only required for direct connections (not when connected through another person)
    if (!connectedThroughId && !relationshipToUserId) {
      return apiResponse.error('Relationship to user is required');
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

    // Create person data based on whether it's a direct or indirect connection
    const personData: Prisma.PersonCreateInput = {
      user: {
        connect: { id: session.user.id },
      },
      name,
      surname: surname || null,
      nickname: nickname || null,
      lastContact: lastContact ? new Date(lastContact) : null,
      notes: notes || null,
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

      // Create inverse relationship if it exists (base person -> new person)
      if (relationshipType?.inverseId) {
        await prisma.relationship.create({
          data: {
            personId: connectedThroughId,
            relatedPersonId: person.id,
            relationshipTypeId: relationshipType.inverseId,
          },
        });
      }
    }

    return apiResponse.created({ person });
  } catch (error) {
    return handleApiError(error, 'people-create');
  }
});
