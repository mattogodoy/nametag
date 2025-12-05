import { prisma } from '@/lib/prisma';
import { createRelationshipSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// POST /api/relationships - Create a new relationship (bidirectional)
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createRelationshipSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personId, relatedPersonId, relationshipTypeId, notes } = validation.data;

    if (!relationshipTypeId) {
      return apiResponse.error('Relationship type is required');
    }

    // Prevent self-relationships
    if (personId === relatedPersonId) {
      return apiResponse.error('Cannot create a relationship with the same person');
    }

    // Check for duplicate relationship
    const existingRelationship = await prisma.relationship.findFirst({
      where: {
        personId,
        relatedPersonId,
        relationshipTypeId,
      },
    });

    if (existingRelationship) {
      return apiResponse.error('This relationship already exists');
    }

    // Verify both people belong to the user
    const [person, relatedPerson, relationshipType] = await Promise.all([
      prisma.person.findUnique({
        where: { id: personId, userId: session.user.id },
      }),
      prisma.person.findUnique({
        where: { id: relatedPersonId, userId: session.user.id },
      }),
      prisma.relationshipType.findFirst({
        where: {
          id: relationshipTypeId,
          OR: [
            { userId: null }, // Default types
            { userId: session.user.id }, // User's custom types
          ],
        },
      }),
    ]);

    if (!person || !relatedPerson) {
      return apiResponse.notFound('One or both people not found');
    }

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    // Create the primary relationship
    const relationship = await prisma.relationship.create({
      data: {
        personId,
        relatedPersonId,
        relationshipTypeId,
        notes: notes || null,
      },
    });

    // Create the inverse relationship if applicable
    if (relationshipType.inverseId) {
      // Check if inverse relationship already exists
      const existingInverse = await prisma.relationship.findFirst({
        where: {
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipTypeId: relationshipType.inverseId,
        },
      });

      // Only create if it doesn't exist
      if (!existingInverse) {
        await prisma.relationship.create({
          data: {
            personId: relatedPersonId,
            relatedPersonId: personId,
            relationshipTypeId: relationshipType.inverseId,
            notes: notes || null,
          },
        });
      }
    }

    return apiResponse.created({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-create');
  }
});
