import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateImportantDateSchema, validateRequest } from '@/lib/validations';

// PUT /api/people/[id]/important-dates/[dateId] - Update an important date
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, dateId } = await params;
    const body = await request.json();
    const validation = validateRequest(updateImportantDateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { title, date, reminderEnabled, reminderType, reminderInterval, reminderIntervalUnit } = validation.data;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Update the important date
    const updatedDate = await prisma.importantDate.update({
      where: {
        id: dateId,
        personId: id,
      },
      data: {
        title,
        date: new Date(date),
        reminderEnabled: reminderEnabled ?? false,
        reminderType: reminderEnabled ? reminderType : null,
        reminderInterval: reminderEnabled && reminderType === 'RECURRING' ? reminderInterval : null,
        reminderIntervalUnit: reminderEnabled && reminderType === 'RECURRING' ? reminderIntervalUnit : null,
      },
    });

    return NextResponse.json({ importantDate: updatedDate });
  } catch (error) {
    console.error('Error updating important date:', error);
    return NextResponse.json(
      { error: 'Failed to update important date' },
      { status: 500 }
    );
  }
}

// DELETE /api/people/[id]/important-dates/[dateId] - Delete an important date
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; dateId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, dateId } = await params;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Delete the important date
    await prisma.importantDate.delete({
      where: {
        id: dateId,
        personId: id,
      },
    });

    return NextResponse.json({ message: 'Important date deleted successfully' });
  } catch (error) {
    console.error('Error deleting important date:', error);
    return NextResponse.json(
      { error: 'Failed to delete important date' },
      { status: 500 }
    );
  }
}
