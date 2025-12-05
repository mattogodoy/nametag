import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGroupSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

// GET /api/groups - List all groups for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        people: {
          include: {
            person: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ groups });
  } catch (error) {
    return handleApiError(error, 'groups-list');
  }
});

// POST /api/groups - Create a new group
export const POST = withAuth(async (request, session) => {
  try {
    const body = await request.json();
    const validation = validateRequest(createGroupSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, description, color } = validation.data;

    // Check if a group with the same name already exists for this user (case-insensitive)
    const existingGroup = await prisma.group.findFirst({
      where: {
        userId: session.user.id,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingGroup) {
      return NextResponse.json(
        { error: 'A group with this name already exists' },
        { status: 400 }
      );
    }

    const group = await prisma.group.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        color: color || null,
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'groups-create');
  }
});
