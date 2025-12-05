import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateThemeSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
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
});
