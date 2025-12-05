import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { updateProfileSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

const TOKEN_EXPIRY_HOURS = 24;

function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateProfileSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, surname, nickname, email } = validation.data;

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
      const verifyToken = generateVerificationToken();
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
          emailVerifyToken: verifyToken,
          emailVerifyExpires: verifyExpires,
          emailVerifySentAt: new Date(),
        },
      });

      // Send verification email to new address
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
    });

    return apiResponse.ok({ user, emailChanged: false });
  } catch (error) {
    return handleApiError(error, 'user-profile-update');
  }
});
