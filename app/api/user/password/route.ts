import { prisma } from '@/lib/prisma';
import { invalidateUserSessions } from '@/lib/session-invalidation';
import * as bcrypt from 'bcryptjs';
import { updatePasswordSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
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
      return apiResponse.notFound('User not found');
    }

    // OAuth users don't have passwords
    if (!user.password) {
      return apiResponse.error('Cannot change password for OAuth accounts');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return apiResponse.error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and sign out every device and browser
    await invalidateUserSessions(session.user.id, hashedPassword);

    return apiResponse.message('Password changed successfully');
  } catch (error) {
    return handleApiError(error, 'user-password-change');
  }
});
