import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { name, label, color, inverseId, inverseLabel } = body;

    if (!name || !label) {
      return NextResponse.json(
        { error: 'Name and label are required' },
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
        name: name.toUpperCase().replace(/\s+/g, '_'),
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
