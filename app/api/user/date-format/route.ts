import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { dateFormat } = body;

    if (!dateFormat || !['MDY', 'DMY', 'YMD'].includes(dateFormat)) {
      return NextResponse.json(
        { error: 'Invalid date format. Must be MDY, DMY, or YMD' },
        { status: 400 }
      );
    }

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
