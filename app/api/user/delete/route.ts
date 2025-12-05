import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { handleApiError, withAuth } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export const DELETE = withAuth(async (request, session) => {
  try {
    const body = await request.json();
    const { password, confirmationText } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Verify confirmation text
    if (confirmationText !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation text must be "DELETE"' },
        { status: 400 }
      );
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Password is incorrect' },
        { status: 400 }
      );
    }

    // Delete user (cascade will delete all related data)
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    logger.info('Account deleted', { userId: session.user.id });

    return NextResponse.json({
      message: 'Account deleted successfully',
      success: true,
    });
  } catch (error) {
    return handleApiError(error, 'user-delete');
  }
});
