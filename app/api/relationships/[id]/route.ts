import { prisma } from '@/lib/prisma';
import { updateRelationshipSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// PUT /api/relationships/[id] - Update a relationship
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
    const validation = validateRequest(updateRelationshipSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { relationshipTypeId, notes } = validation.data;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id },
      include: {
        person: true,
        relatedPerson: true,
      },
    });

    if (!existing) {
      return apiResponse.notFound('Relationship not found');
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    if (!relationshipTypeId) {
      return apiResponse.error('Relationship type is required');
    }

    // Get the new relationship type to find its inverse
    const relationshipType = await prisma.relationshipType.findFirst({
      where: {
        id: relationshipTypeId,
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
      },
    });

    if (!relationshipType) {
      return apiResponse.notFound('Relationship type not found');
    }

    // Update the primary relationship
    const relationship = await prisma.relationship.update({
      where: { id },
      data: {
        relationshipTypeId,
        notes: notes || null,
      },
    });

    // Find and update the inverse relationship
    const inverse = await prisma.relationship.findFirst({
      where: {
        personId: existing.relatedPersonId,
        relatedPersonId: existing.personId,
      },
    });

    if (inverse && relationshipType.inverseId) {
      await prisma.relationship.update({
        where: { id: inverse.id },
        data: {
          relationshipTypeId: relationshipType.inverseId,
          notes: notes || null,
        },
      });
    }

    return apiResponse.ok({ relationship });
  } catch (error) {
    return handleApiError(error, 'relationships-update');
  }
});

// DELETE /api/relationships/[id] - Delete a relationship
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id },
      include: {
        person: true,
      },
    });

    if (!existing) {
      return apiResponse.notFound('Relationship not found');
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return apiResponse.unauthorized();
    }

    // Delete the primary relationship
    await prisma.relationship.delete({
      where: { id },
    });

    // Find and delete the inverse relationship
    const inverse = await prisma.relationship.findFirst({
      where: {
        personId: existing.relatedPersonId,
        relatedPersonId: existing.personId,
      },
    });

    if (inverse) {
      await prisma.relationship.delete({
        where: { id: inverse.id },
      });
    }

    return apiResponse.message('Relationship deleted successfully');
  } catch (error) {
    return handleApiError(error, 'relationships-delete');
  }
});
