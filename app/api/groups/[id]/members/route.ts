import { prisma } from '@/lib/prisma';
import { addGroupMemberSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// POST /api/groups/[id]/members - Add a member to a group
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(addGroupMemberSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { personId } = validation.data;

    // Verify group belongs to user
    const group = await prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!group) {
      return apiResponse.notFound('Group not found');
    }

    // Verify person belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        userId: session.user.id,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Check if already a member
    const existingMembership = await prisma.personGroup.findUnique({
      where: {
        personId_groupId: {
          personId,
          groupId: id,
        },
      },
    });

    if (existingMembership) {
      return apiResponse.error('Person is already a member of this group');
    }

    // Add person to group
    await prisma.personGroup.create({
      data: {
        personId,
        groupId: id,
      },
    });

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'groups-add-member');
  }
});
