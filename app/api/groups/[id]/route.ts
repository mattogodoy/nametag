import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateGroupSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

// GET /api/groups/[id] - Get a single group
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    const group = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        people: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json({ group });
  } catch (error) {
    return handleApiError(error, 'groups-get');
  }
});

// PUT /api/groups/[id] - Update a group
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;

    const body = await request.json();
    const validation = validateRequest(updateGroupSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, description, color } = validation.data;

    // Check if group exists and belongs to user
    const existingGroup = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if another group with the same name already exists for this user (case-insensitive)
    const duplicateGroup = await prisma.group.findFirst({
      where: {
        userId: session.user.id,
        name: {
          equals: name,
          mode: 'insensitive',
        },
        id: {
          not: id, // Exclude the current group
        },
      },
    });

    if (duplicateGroup) {
      return NextResponse.json(
        { error: 'A group with this name already exists' },
        { status: 400 }
      );
    }

    const group = await prisma.group.update({
      where: {
        id,
      },
      data: {
        name,
        description: description || null,
        color: color || null,
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    return handleApiError(error, 'groups-update');
  }
});

// DELETE /api/groups/[id] - Delete a group
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // Check if group exists and belongs to user
    const existingGroup = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    await prisma.group.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ message: 'Group deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'groups-delete');
  }
});
