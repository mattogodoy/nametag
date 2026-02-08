import { prisma } from '@/lib/prisma';
import { createRelationshipSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// GET /api/relationships - List all relationships for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const relationships = await prisma.relationship.findMany({
      where: {
        person: { userId: session.user.id, deletedAt: null },
        relatedPerson: { deletedAt: null },
        OR: [
          { relationshipTypeId: null },
          { relationshipType: { deletedAt: null } },
        ],
      },
      include: {
        person: {
          select: { id: true, name: true, surname: true, nickname: true },
        },
        relatedPerson: {
          select: { id: true, name: true, surname: true, nickname: true },
        },
        relationshipType: {
          select: { id: true, name: true, label: true, color: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return apiResponse.ok({ relationships });
  } catch (error) {
    return handleApiError(error, 'relationships-list');
  }
});

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
          userId: session.user.id,
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

    // Always create the inverse relationship
    // Use the inverse type if it exists, otherwise use the same type
    const inverseTypeId = relationshipType.inverseId || relationshipTypeId;

    // Check if inverse relationship already exists
    const existingInverse = await prisma.relationship.findFirst({
      where: {
        personId: relatedPersonId,
        relatedPersonId: personId,
        relationshipTypeId: inverseTypeId,
        deletedAt: null,
      },
    });

    // Only create if it doesn't exist
    if (!existingInverse) {
      await prisma.relationship.create({
        data: {
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipTypeId: inverseTypeId,
          notes: notes || null,
        },
      });
    }

    return apiResponse.created({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-create');
  }
});
