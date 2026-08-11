import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { updateProfileSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth, normalizeEmail } from '@/lib/api-utils';
import { getAppUrl } from '@/lib/env';
import { generateToken, hashToken } from '@/lib/token-hash';

const TOKEN_EXPIRY_HOURS = 24;

/**
 * The only user columns this endpoint may return.
 *
 * An allowlist rather than a denylist on purpose: a column added by a future
 * migration is excluded until someone deliberately adds it here. The row also
 * holds the bcrypt password hash and live account-recovery tokens, none of
 * which should ever reach a client.
 */
const PUBLIC_PROFILE_FIELDS = {
  id: true,
  email: true,
  name: true,
  surname: true,
  nickname: true,
  theme: true,
  dateFormat: true,
  language: true,
  nameOrder: true,
  nameDisplayFormat: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/user/profile - Get the current user's profile
export const GET = withAuth(async (_request, session) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: PUBLIC_PROFILE_FIELDS,
    });

    if (!user) {
      return apiResponse.notFound('User not found');
    }

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-profile-get');
  }
});

// PUT /api/user/profile - Update the current user's profile
export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateProfileSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, surname, nickname } = validation.data;

    // Normalize email to lowercase for case-insensitive lookup
    const email = normalizeEmail(validation.data.email);

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== session.user.id) {
      return apiResponse.error('Email already in use');
    }

    // Check if email is being changed
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    const emailChanged = currentUser?.email !== email;

    if (emailChanged) {
      // Generate new verification token
      const rawToken = generateToken();
      const hashedToken = hashToken(rawToken);
      const verifyExpires = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      // Update user with new email and require verification
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name,
          surname: surname || null,
          nickname: nickname || null,
          email,
          emailVerified: false,
          emailVerifyToken: hashedToken,
          emailVerifyExpires: verifyExpires,
          emailVerifySentAt: new Date(),
        },
        // This branch does not return the user, but selecting narrowly keeps the
        // password hash out of process memory rather than relying on the caller
        // to keep not returning it.
        select: { id: true },
      });

      // Send verification email to new address with raw token
      const verificationUrl = `${getAppUrl()}/verify-email?token=${rawToken}`;
      const { subject, html, text } = await emailTemplates.accountVerification(verificationUrl);

      await sendEmail({
        to: email,
        subject,
        html,
        text,
        from: 'accounts',
      });

      return apiResponse.ok({ emailChanged: true });
    }

    // Email not changed - just update profile
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
        surname: surname || null,
        nickname: nickname || null,
        email,
      },
      // Mirrors the allowlist on GET, so both halves of this endpoint return the
      // same shape. Without it Prisma returns every column, which includes the
      // password hash and live account-recovery tokens.
      select: PUBLIC_PROFILE_FIELDS,
    });

    return apiResponse.ok({ user, emailChanged: false });
  } catch (error) {
    return handleApiError(error, 'user-profile-update');
  }
});
