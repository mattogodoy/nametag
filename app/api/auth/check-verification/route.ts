import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVerificationSchema, validateRequest } from '@/lib/validations';
import { parseRequestBody, normalizeEmail, withLogging } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export const POST = withLogging(async function POST(request: Request) {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(checkVerificationSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    // Normalize email to lowercase for case-insensitive lookup
    const email = normalizeEmail(validation.data.email);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    if (!user) {
      // Don't reveal whether user exists
      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: user.emailVerified });
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Check verification error');
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
});
