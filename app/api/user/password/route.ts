import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { updatePasswordSchema, validateRequest } from '@/lib/validations';
import { handleApiError, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await request.json();
    const validation = validateRequest(updatePasswordSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error) {
    return handleApiError(error, 'user-password-change');
  }
});
