import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export const DELETE = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody<{ password?: string; confirmationText?: string }>(request);
    const { password, confirmationText } = body;

    if (!password) {
      return apiResponse.error('Password is required');
    }

    // Verify confirmation text
    if (confirmationText !== 'DELETE') {
      return apiResponse.error('Confirmation text must be "DELETE"');
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return apiResponse.notFound('User not found');
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return apiResponse.error('Password is incorrect');
    }

    // Delete user (cascade will delete all related data)
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    logger.info('Account deleted', { userId: session.user.id });

    return apiResponse.ok({
      message: 'Account deleted successfully',
      success: true,
    });
  } catch (error) {
    return handleApiError(error, 'user-delete');
  }
});
