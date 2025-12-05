import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { resendVerificationSchema, validateRequest } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { handleApiError, parseRequestBody } from '@/lib/api-utils';

const TOKEN_EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_MINUTES = 2;

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  // Check rate limit
  const rateLimitResponse = checkRateLimit(request, 'resendVerification');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(resendVerificationSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { email } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        emailVerifySentAt: true,
      },
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a verification link has been sent.' },
        { status: 200 }
      );
    }

    // Already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { message: 'Email is already verified. You can log in.' },
        { status: 200 }
      );
    }

    // Check cooldown period
    if (user.emailVerifySentAt) {
      const timeSinceLastSend = Date.now() - user.emailVerifySentAt.getTime();
      const cooldownMs = RESEND_COOLDOWN_MINUTES * 60 * 1000;

      if (timeSinceLastSend < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting another verification email.`,
            retryAfter: remainingSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Generate new token
    const verifyToken = generateVerificationToken();
    const verifyExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        emailVerifySentAt: new Date(),
      },
    });

    // Send verification email
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
    const { subject, html, text } = emailTemplates.accountVerification(verificationUrl);

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      from: 'accounts',
    });

    return NextResponse.json(
      { message: 'Verification email sent. Please check your inbox.' },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, 'resend-verification');
  }
}
