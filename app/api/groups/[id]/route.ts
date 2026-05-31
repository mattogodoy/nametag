import { prisma } from '@/lib/prisma';
import { updateGroupSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { getRandomColor } from '@/lib/colors';

// GET /api/groups/[id] - Get a single group
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const group = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
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
      return apiResponse.notFound('Group not found');
    }

    return apiResponse.ok({ group });
  } catch (error) {
    return handleApiError(error, 'groups-get');
  }
});

// PUT /api/groups/[id] - Update a group
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    const body = await parseRequestBody(request);
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
        deletedAt: null,
      },
    });

    if (!existingGroup) {
      return apiResponse.notFound('Group not found');
    }

    // Check if another group with the same name already exists for this user (case-insensitive)
    const duplicateGroup = await prisma.group.findFirst({
      where: {
        userId: session.user.id,
        deletedAt: null,
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
      return apiResponse.error('A group with this name already exists');
    }

    const group = await prisma.group.update({
      where: {
        id,
      },
      data: {
        name,
        description: description || null,
        color: color ?? existingGroup.color ?? getRandomColor(),
      },
    });

    return apiResponse.ok({ group });
  } catch (error) {
    return handleApiError(error, 'groups-update');
  }
});

// DELETE /api/groups/[id] - Delete a group
export const DELETE = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    // Check if deletePeople parameter is set
    const url = new URL(request.url);
    const deletePeople = url.searchParams.get('deletePeople') === 'true';

    // Check if group exists and belongs to user
    const existingGroup = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        people: {
          select: {
            personId: true,
          },
        },
      },
    });

    if (!existingGroup) {
      return apiResponse.notFound('Group not found');
    }

    // If deletePeople is true, delete all people in the group
    if (deletePeople && existingGroup.people.length > 0) {
      const personIds = existingGroup.people.map((p) => p.personId);

      // Soft delete all people in the group
      await prisma.person.updateMany({
        where: {
          id: { in: personIds },
          userId: session.user.id, // Extra safety check
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }

    // Soft delete the group (set deletedAt instead of removing)
    await prisma.group.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return apiResponse.message('Group deleted successfully');
  } catch (error) {
    return handleApiError(error, 'groups-delete');
  }
});
