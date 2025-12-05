import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateDateFormatSchema, validateRequest } from '@/lib/validations';

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(updateDateFormatSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { dateFormat } = validation.data;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { dateFormat },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating date format:', error);
    return NextResponse.json(
      { error: 'Failed to update date format' },
      { status: 500 }
    );
  }
}
