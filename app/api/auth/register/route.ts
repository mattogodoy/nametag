import { NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { registerSchema, validateRequest } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit-redis';
import { handleApiError, parseRequestBody, normalizeEmail } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import { createFreeSubscription } from '@/lib/billing';
import { createPreloadedRelationshipTypes } from '@/lib/relationship-types';
import { isFeatureEnabled } from '@/lib/features';
import { getAppUrl } from '@/lib/env';

const TOKEN_EXPIRY_HOURS = 24;

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export async function POST(request: Request) {
  // Check rate limit (async with Redis)
  const rateLimitResponse = await checkRateLimit(request, 'register');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Check if registration is disabled
    if (process.env.DISABLE_REGISTRATION === 'true') {
      const userCount = await prisma.user.count();
      if (userCount > 0) {
        return NextResponse.json(
          { error: 'Registration is currently disabled' },
          { status: 403 }
        );
      }
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(registerSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { password, name, surname, nickname } = validation.data;

    // Normalize email to lowercase to prevent case-sensitivity issues
    const email = normalizeEmail(validation.data.email);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if email verification is enabled (SaaS mode only)
    const requireEmailVerification = isFeatureEnabled('emailVerification');

    // Generate verification token only if verification is required
    const verifyToken = requireEmailVerification ? generateVerificationToken() : null;
    const verifyExpires = requireEmailVerification
      ? new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
      : null;

    // Create user - auto-verify in self-hosted mode
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        surname: surname || null,
        nickname: nickname || null,
        emailVerified: !requireEmailVerification, // Auto-verify in self-hosted mode
        emailVerifyToken: verifyToken,
        emailVerifyExpires: verifyExpires,
        emailVerifySentAt: requireEmailVerification ? new Date() : null,
      },
    });

    // Create free subscription for new user
    await createFreeSubscription(user.id);

    // Create pre-loaded relationship types for new user
    await createPreloadedRelationshipTypes(prisma, user.id);

    // Send verification email only in SaaS mode
    if (requireEmailVerification) {
      const verificationUrl = `${getAppUrl()}/verify-email?token=${verifyToken}`;
      const { subject, html, text } = await emailTemplates.accountVerification(verificationUrl);

      await sendEmail({
        to: email,
        subject,
        html,
        text,
        from: 'accounts',
      });
    }

    logger.info({
      email,
      userId: user.id,
      emailVerificationRequired: requireEmailVerification,
    }, 'User registered successfully');

    return NextResponse.json(
      {
        message: requireEmailVerification
          ? 'Account created. Please check your email to verify your account.'
          : 'Account created successfully. You can now log in.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'register');
  }
}
