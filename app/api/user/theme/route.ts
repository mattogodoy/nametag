import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateThemeSchema, validateRequest } from '@/lib/validations';
import { handleApiError } from '@/lib/api-utils';

export async function PUT(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = validateRequest(updateThemeSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { theme } = validation.data;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { theme },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, 'user-theme-update');
  }
}
