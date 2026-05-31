import { prisma } from '@/lib/prisma';
import { createGroupSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { getRandomColor } from '@/lib/colors';
import { canCreateResource } from '@/lib/billing';

// GET /api/groups - List all groups for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
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
      orderBy: {
        name: 'asc',
      },
    });

    return apiResponse.ok({ groups });
  } catch (error) {
    return handleApiError(error, 'groups-list');
  }
});

// POST /api/groups - Create a new group
export const POST = withAuth(async (request, session) => {
  try {
    // Check if user has reached their plan limit for groups
    const usageCheck = await canCreateResource(session.user.id, 'groups');
    if (!usageCheck.allowed) {
      return apiResponse.forbidden(
        `You've reached your plan limit of ${usageCheck.limit} groups. ` +
        `Please upgrade your plan to add more.`
      );
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(createGroupSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, description, color, peopleIds } = validation.data;

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedName = sanitizeName(name) || name;
    const sanitizedDescription = description ? sanitizeNotes(description) : null;

    // Check if a group with the same name already exists for this user (case-insensitive)
    const existingGroup = await prisma.group.findFirst({
      where: {
        userId: session.user.id,
        deletedAt: null,
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingGroup) {
      return apiResponse.error('A group with this name already exists');
    }

    // Create the group and optionally add people to it
    const group = await prisma.group.create({
      data: {
        userId: session.user.id,
        name: sanitizedName,
        description: sanitizedDescription,
        color: color || getRandomColor(),
        // If peopleIds are provided, create PersonGroup associations
        ...(peopleIds && peopleIds.length > 0 && {
          people: {
            create: peopleIds.map((personId) => ({
              person: {
                connect: { id: personId },
              },
            })),
          },
        }),
      },
      include: {
        people: {
          include: {
            person: true,
          },
        },
      },
    });

    return apiResponse.created({ group });
  } catch (error) {
    return handleApiError(error, 'groups-create');
  }
});
