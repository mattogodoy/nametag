import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addGroupMemberSchema, validateRequest } from '@/lib/validations';

// POST /api/groups/[id]/members - Add a member to a group
export async function POST(
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
    console.error('Error adding member to group:', error);
    return NextResponse.json(
      { error: 'Failed to add member to group' },
      { status: 500 }
    );
  }
}
