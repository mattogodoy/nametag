import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRelationshipSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

// POST /api/relationships - Create a new relationship (bidirectional)
export const POST = withAuth(async (request, session) => {
  try {
    const body = await request.json();
    const validation = validateRequest(createRelationshipSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personId, relatedPersonId, relationshipTypeId, notes } = validation.data;

    if (!relationshipTypeId) {
      return NextResponse.json(
        { error: 'Relationship type is required' },
        { status: 400 }
      );
    }

    // Prevent self-relationships
    if (personId === relatedPersonId) {
      return NextResponse.json(
        { error: 'Cannot create a relationship with the same person' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'This relationship already exists' },
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

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'relationships-create');
  }
});
