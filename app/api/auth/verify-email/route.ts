import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withLogging } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { hashToken } from '@/lib/token-hash';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateOrigin } from '@/lib/csrf';

export const POST = withLogging(async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return apiError('invalid_origin', 'Invalid request origin');
  }

  try {
    const rateLimitResponse = checkRateLimit(request, 'verifyEmail');
    if (rateLimitResponse) return rateLimitResponse;

    const { token } = await parseRequestBody<{ token?: string }>(request);

    if (!token) {
      return apiError('bad_request', 'Verification token is required');
    }

    // Hash the incoming token to compare against stored hash
    const hashedToken = hashToken(token);

    // Find user with this token
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: hashedToken },
    });

    if (!user) {
      return apiError('bad_request', 'Invalid verification token');
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email already verified' },
        { status: 200 }
      );
    }

    // Check if token has expired
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return apiError('bad_request', 'Verification token has expired. Please request a new one.');
    }

    // Verify the email
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    logger.info({ userId: user.id }, 'Email verified successfully');

    return NextResponse.json(
      { message: 'Email verified successfully. You can now log in.' },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, 'verify-email');
  }
});
