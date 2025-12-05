import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema, validateRequest } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { handleApiError, parseRequestBody } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  // Check rate limit
  const rateLimitResponse = checkRateLimit(request, 'resetPassword');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(resetPasswordSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { token, password } = validation.data;

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with new password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordResetSentAt: null,
      },
    });

    logger.info('Password reset successful', { userId: user.id });

    return NextResponse.json(
      { message: 'Password has been reset successfully. You can now log in with your new password.' },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, 'reset-password');
  }
}
