import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { forgotPasswordSchema, validateRequest } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { handleApiError, parseRequestBody, normalizeEmail, withLogging } from '@/lib/api-utils';
import { getAppUrl } from '@/lib/env';
import { generateToken, hashToken } from '@/lib/token-hash';
import { validateOrigin } from '@/lib/csrf';
import { isFeatureEnabled } from '@/lib/features';

const TOKEN_EXPIRY_HOURS = 1;
const RESEND_COOLDOWN_MINUTES = 2;

export const POST = withLogging(async function POST(request: Request) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  // Unkeyed (IP-only) check before the body is parsed. There is no email to
  // key on yet at this point, but a request that never becomes a
  // well-formed, schema-valid body would otherwise hit no rate limit at
  // all, since the email-keyed check below only runs after parsing
  // succeeds. This restores the bound that existed before email keying was
  // added.
  const preParseRateLimitResponse = checkRateLimit(request, 'forgotPassword');
  if (preParseRateLimitResponse) {
    return preParseRateLimitResponse;
  }

  try {
    if (!isFeatureEnabled('passwordLogin')) {
      return NextResponse.json(
        { error: 'Password login is disabled on this instance.' },
        { status: 403 }
      );
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(forgotPasswordSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    // Normalize email to lowercase for case-insensitive lookup
    const email = normalizeEmail(validation.data.email);

    // Rate limit by email (and, when a trusted IP is available, by IP too).
    // This is a mail-bombing vector: an attacker who rotates the client IP
    // still shares a bucket with every other request for the same address.
    const rateLimitResponse = checkRateLimit(request, 'forgotPassword', email);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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
    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);
    const resetExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Update user with hashed token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: resetExpires,
        passwordResetSentAt: new Date(),
      },
    });

    // Send reset email with raw token
    const resetUrl = `${getAppUrl()}/reset-password?token=${rawToken}`;
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
