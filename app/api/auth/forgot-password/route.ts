import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { forgotPasswordSchema, validateRequest } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { handleApiError, parseRequestBody, normalizeEmail, withLogging } from '@/lib/api-utils';
import { getAppUrl } from '@/lib/env';

const TOKEN_EXPIRY_HOURS = 1;
const RESEND_COOLDOWN_MINUTES = 2;

function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export const POST = withLogging(async function POST(request: Request) {
  // Check rate limit
  const rateLimitResponse = checkRateLimit(request, 'forgotPassword');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(forgotPasswordSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    // Normalize email to lowercase for case-insensitive lookup
    const email = normalizeEmail(validation.data.email);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordResetSentAt: true,
      },
    });

    // Don't reveal if user exists or not for security
    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a password reset link has been sent.' },
        { status: 200 }
      );
    }

    // Check cooldown period
    if (user.passwordResetSentAt) {
      const timeSinceLastSend = Date.now() - user.passwordResetSentAt.getTime();
      const cooldownMs = RESEND_COOLDOWN_MINUTES * 60 * 1000;

      if (timeSinceLastSend < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastSend) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${remainingSeconds} seconds before requesting another reset email.`,
            retryAfter: remainingSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Generate new token
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
        passwordResetSentAt: new Date(),
      },
    });

    // Send reset email
    const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;
    const { subject, html, text } = await emailTemplates.passwordReset(resetUrl);

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      from: 'accounts',
    });

    return NextResponse.json(
      { message: 'If an account exists with this email, a password reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, 'forgot-password');
  }
});
