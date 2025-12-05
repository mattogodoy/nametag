import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addGroupMemberSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

// POST /api/groups/[id]/members - Add a member to a group
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;
    const body = await request.json();
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
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Verify person belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id: personId,
        userId: session.user.id,
      },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
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
      return NextResponse.json(
        { error: 'Person is already a member of this group' },
        { status: 400 }
      );
    }

    // Add person to group
    await prisma.personGroup.create({
      data: {
        personId,
        groupId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'groups-add-member');
  }
});
