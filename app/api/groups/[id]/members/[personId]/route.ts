import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// DELETE /api/groups/[id]/members/[personId] - Remove a member from a group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; personId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, personId } = await params;

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

    // Remove person from group
    const deleted = await prisma.personGroup.deleteMany({
      where: {
        personId,
        groupId: id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Person is not a member of this group' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing member from group:', error);
    return NextResponse.json(
      { error: 'Failed to remove member from group' },
      { status: 500 }
    );
  }
}
