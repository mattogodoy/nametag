import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateGroupSchema, validateRequest } from '@/lib/validations';
import { handleApiError } from '@/lib/api-utils';

// GET /api/groups/[id] - Get a single group
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
}

// PUT /api/groups/[id] - Update a group
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
}

// DELETE /api/groups/[id] - Delete a group
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
}
