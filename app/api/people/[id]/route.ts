import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/people/[id] - Get a single person
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        relationshipToUser: true,
        groups: {
          include: {
            group: true,
          },
        },
        relationshipsFrom: {
          include: {
            relatedPerson: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ person });
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/people/[id] - Update a person
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
    const { name, surname, nickname, birthDate, phone, address, lastContact, notes, relationshipToUserId, groupIds } =
      body;

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Relationship is not required for people with indirect connections
    // (they are connected through other people in the network)

    // Build update data
    const updateData: any = {
      name,
      surname: surname || null,
      nickname: nickname || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      phone: phone || null,
      address: address || null,
      lastContact: lastContact ? new Date(lastContact) : null,
      notes: notes || null,
      groups: groupIds
        ? {
            deleteMany: {},
            create: groupIds.map((groupId: string) => ({
              groupId,
            })),
          }
        : undefined,
    };

    // Only update relationshipToUserId if it's provided
    if (relationshipToUserId) {
      updateData.relationshipToUser = {
        connect: { id: relationshipToUserId }
      };
    }

    // Update person and handle group associations
    const person = await prisma.person.update({
      where: {
        id,
      },
      data: updateData,
      include: {
        groups: {
          include: {
            group: true,
          },
        },
      },
    });

    return NextResponse.json({ person });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/people/[id] - Delete a person
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

    // Check if person exists and belongs to user
    const existingPerson = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Parse request body to check if we should also delete orphans
    const body = await request.json().catch(() => ({}));
    const { deleteOrphans, orphanIds } = body;

    // Delete the person
    await prisma.person.delete({
      where: {
        id,
      },
    });

    // If requested, also delete the orphans
    if (deleteOrphans && orphanIds && Array.isArray(orphanIds)) {
      await prisma.person.deleteMany({
        where: {
          id: {
            in: orphanIds,
          },
          userId: session.user.id, // Ensure they belong to the user
        },
      });
    }

    return NextResponse.json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
