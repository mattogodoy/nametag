import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PUT /api/relationships/[id] - Update a relationship
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { relationshipTypeId, notes } = body;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id },
      include: {
        person: true,
        relatedPerson: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json(
        { error: 'Relationship type not found' },
        { status: 404 }
      );
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

    return NextResponse.json({ relationship });
  } catch (error) {
    console.error('Error updating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to update relationship' },
      { status: 500 }
    );
  }
}

// DELETE /api/relationships/[id] - Delete a relationship
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the existing relationship
    const existing = await prisma.relationship.findUnique({
      where: { id },
      include: {
        person: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      );
    }

    // Verify the person belongs to the user
    if (existing.person.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({
      message: 'Relationship deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    return NextResponse.json(
      { error: 'Failed to delete relationship' },
      { status: 500 }
    );
  }
}
