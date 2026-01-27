import { prisma } from '@/lib/prisma';
import { createRelationshipTypeSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session) => {
  // Get all relationship types for the user
  const relationshipTypes = await prisma.relationshipType.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      inverse: {
        select: {
          id: true,
          name: true,
          label: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return apiResponse.ok({ relationshipTypes });
});

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createRelationshipTypeSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, label, color, inverseId, inverseLabel, symmetric } = validation.data;

    const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

    // Check if a relationship type with this name already exists (case-insensitive)
    const existingType = await prisma.relationshipType.findFirst({
      where: {
        userId: session.user.id,
        name: { equals: normalizedName, mode: 'insensitive' },
      },
    });

    if (existingType) {
      return apiResponse.error('A relationship type with this name already exists');
    }

    // Handle symmetric relationships (e.g., friend <-> friend)
    if (symmetric) {
      // Create the type first without inverse
      const relationshipType = await prisma.relationshipType.create({
        data: {
          userId: session.user.id,
          name: normalizedName,
          label,
          color: color || null,
        },
      });

      // Update it to point to itself as the inverse
      const updatedType = await prisma.relationshipType.update({
        where: { id: relationshipType.id },
        data: { inverseId: relationshipType.id },
        include: {
          inverse: {
            select: {
              id: true,
              name: true,
              label: true,
            },
          },
        },
      });

      return apiResponse.created({ relationshipType: updatedType });
    }

    let finalInverseId = inverseId || null;

    // If inverseLabel is provided (new type to create), create it first
    if (inverseLabel && !inverseId) {
      const inverseName = inverseLabel
        .toUpperCase()
        .replace(/\s+/g, '_');

      // Check if inverse type already exists
      const existingInverseType = await prisma.relationshipType.findFirst({
        where: {
          userId: session.user.id,
          name: { equals: inverseName, mode: 'insensitive' },
        },
      });

      if (existingInverseType) {
        return apiResponse.error(`The inverse relationship type "${inverseLabel}" already exists`);
      }

      // Create the inverse type with the same color
      const inverseType = await prisma.relationshipType.create({
        data: {
          userId: session.user.id,
          name: inverseName,
          label: inverseLabel,
          color: color || null,
          // Leave inverseId null for now, will update after creating the main type
        },
      });

      finalInverseId = inverseType.id;
    }

    // Create the main relationship type
    const relationshipType = await prisma.relationshipType.create({
      data: {
        userId: session.user.id,
        name: normalizedName,
        label,
        color: color || null,
        inverseId: finalInverseId,
      },
      include: {
        inverse: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    });

    // If we created a new inverse type, update it to point back to the main type
    if (inverseLabel && finalInverseId) {
      await prisma.relationshipType.update({
        where: { id: finalInverseId },
        data: { inverseId: relationshipType.id },
      });
    }

    return apiResponse.created({ relationshipType });
  } catch (error) {
    return handleApiError(error, 'relationship-types-create');
  }
});
