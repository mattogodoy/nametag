import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/relationships - Create a new relationship (bidirectional)
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { personId, relatedPersonId, relationshipTypeId, notes } = body;

    if (!personId || !relatedPersonId || !relationshipTypeId) {
      return NextResponse.json(
        { error: 'Person ID, related person ID, and relationship type are required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'One or both people not found' },
        { status: 404 }
      );
    }

    if (!relationshipType) {
      return NextResponse.json(
        { error: 'Relationship type not found' },
        { status: 404 }
      );
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
      await prisma.relationship.create({
        data: {
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipTypeId: relationshipType.inverseId,
          notes: notes || null,
        },
      });
    }

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}
