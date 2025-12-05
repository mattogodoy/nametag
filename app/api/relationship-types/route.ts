import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createRelationshipTypeSchema, validateRequest } from '@/lib/validations';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all relationship types (both default and user-created)
  const relationshipTypes = await prisma.relationshipType.findMany({
    where: {
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
    orderBy: [
      { isDefault: 'desc' }, // Defaults first
      { name: 'asc' },
    ],
  });

  return NextResponse.json(relationshipTypes);
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = validateRequest(createRelationshipTypeSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, label, color, inverseId, inverseLabel } = validation.data;

    const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

    // Check if a relationship type with this name already exists (case-insensitive)
    const existingType = await prisma.relationshipType.findFirst({
      where: {
        OR: [
          { userId: null, name: { equals: normalizedName, mode: 'insensitive' } }, // Default types
          { userId: session.user.id, name: { equals: normalizedName, mode: 'insensitive' } }, // User's custom types
        ],
      },
    });

    if (existingType) {
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
          isDefault: false,
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
        isDefault: false,
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

    return NextResponse.json(relationshipType, { status: 201 });
  } catch (error) {
    console.error('Error creating relationship type:', error);
    return NextResponse.json(
      { error: 'Failed to create relationship type' },
      { status: 500 }
    );
  }
}
