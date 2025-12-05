import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updatePersonSchema, deletePersonSchema, validateRequest } from '@/lib/validations';
import { handleApiError } from '@/lib/api-utils';

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
    return handleApiError(error, 'people-get');
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
    const validation = validateRequest(updatePersonSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const {
      name,
      surname,
      nickname,
      lastContact,
      notes,
      relationshipToUserId,
      groupIds,
      importantDates,
      contactReminderEnabled,
      contactReminderInterval,
      contactReminderIntervalUnit,
    } = validation.data;

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

    // Relationship is not required for people with indirect connections
    // (they are connected through other people in the network)

    // Build update data
    const updateData: any = {
      name,
      surname: surname || null,
      nickname: nickname || null,
      lastContact: lastContact ? new Date(lastContact) : null,
      notes: notes || null,
      contactReminderEnabled: contactReminderEnabled ?? false,
      contactReminderInterval: contactReminderEnabled ? contactReminderInterval : null,
      contactReminderIntervalUnit: contactReminderEnabled ? contactReminderIntervalUnit : null,
      groups: groupIds
        ? {
            deleteMany: {},
            create: groupIds.map((groupId: string) => ({
              groupId,
            })),
          }
        : undefined,
      importantDates: importantDates
        ? {
            deleteMany: {},
            create: importantDates.map((date) => ({
              title: date.title,
              date: new Date(date.date),
              reminderEnabled: date.reminderEnabled ?? false,
              reminderType: date.reminderEnabled ? date.reminderType : null,
              reminderInterval: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderInterval : null,
              reminderIntervalUnit: date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderIntervalUnit : null,
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
    return handleApiError(error, 'people-update');
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
    const validation = validateRequest(deletePersonSchema, body);

    // Use validated data, or defaults if body was empty/invalid
    const { deleteOrphans, orphanIds } = validation.success
      ? validation.data
      : { deleteOrphans: false, orphanIds: [] };

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
    return handleApiError(error, 'people-delete');
  }
}
