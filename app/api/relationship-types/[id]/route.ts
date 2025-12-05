import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateRelationshipTypeSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session, context) => {
  const { id } = await context!.params;

  const relationshipType = await prisma.relationshipType.findFirst({
    where: {
      id,
      OR: [
        { userId: null }, // Default types
        { userId: session.user.id }, // User's custom types
      ],
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

  if (!relationshipType) {
    return NextResponse.json(
      { error: 'Relationship type not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(relationshipType);
});

export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;

    // First check if this is a default type
    const existing = await prisma.relationshipType.findFirst({
      where: {
        id,
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship type not found' },
        { status: 404 }
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot modify default relationship types' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = validateRequest(updateRelationshipTypeSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, label, color, inverseId, inverseLabel } = validation.data;

    const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

    // Check if another relationship type with this name already exists (case-insensitive)
    const duplicateType = await prisma.relationshipType.findFirst({
      where: {
        OR: [
          { userId: null, name: { equals: normalizedName, mode: 'insensitive' } }, // Default types
          { userId: session.user.id, name: { equals: normalizedName, mode: 'insensitive' } }, // User's custom types
        ],
        id: {
          not: id, // Exclude the current type being updated
        },
      },
    });

    if (duplicateType) {
      return NextResponse.json(
        { error: 'A relationship type with this name already exists' },
        { status: 400 }
      );
    }

    let finalInverseId = inverseId || null;

    // If inverseLabel is provided (new type to create), create it first
    if (inverseLabel && !inverseId) {
      const inverseName = inverseLabel
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');

      // Check if inverse type already exists
      const existingInverseType = await prisma.relationshipType.findFirst({
        where: {
          OR: [
            { userId: null, name: { equals: inverseName, mode: 'insensitive' } },
            { userId: session.user.id, name: { equals: inverseName, mode: 'insensitive' } },
          ],
        },
      });

      if (existingInverseType) {
        return NextResponse.json(
          { error: `The inverse relationship type "${inverseLabel}" already exists` },
          { status: 400 }
        );
      }

      // Create the inverse type with the same color
      const inverseType = await prisma.relationshipType.create({
        data: {
          userId: session.user.id,
          name: inverseName,
          label: inverseLabel,
          color: color || null,
          inverseId: id, // Link back to the type being edited
          isDefault: false,
        },
      });

      finalInverseId = inverseType.id;
    }

    const relationshipType = await prisma.relationshipType.update({
      where: { id },
      data: {
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

    // Update inverse relationship's color to match
    if (finalInverseId) {
      await prisma.relationshipType.update({
        where: { id: finalInverseId },
        data: { color: color || null },
      });
    }

    return NextResponse.json(relationshipType);
  } catch (error) {
    return handleApiError(error, 'relationship-types-update');
  }
});

export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // First check if this is a default type
    const existing = await prisma.relationshipType.findFirst({
      where: {
        id,
        userId: session.user.id, // Only allow deleting user's own types
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship type not found' },
        { status: 404 }
      );
    }

    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default relationship types' },
        { status: 403 }
      );
    }

    // Check if type is in use
    const inUseCount = await prisma.relationship.count({
      where: { relationshipTypeId: id },
    });

    if (inUseCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete relationship type that is in use by ${inUseCount} relationship(s)`,
        },
        { status: 400 }
      );
    }

    await prisma.relationshipType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'relationship-types-delete');
  }
});
