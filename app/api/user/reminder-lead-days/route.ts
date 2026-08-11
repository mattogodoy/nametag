import { prisma } from '@/lib/prisma';
import { updateReminderLeadDaysSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateReminderLeadDaysSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { days } = validation.data;

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultReminderLeadDays: days },
    });

    // prisma.user.update() returns every column on the row, including the
    // password hash and other sensitive tokens. Strip those before the row
    // reaches the response body; only safe profile fields go out.
    const {
      password: _password,
      emailVerifyToken: _emailVerifyToken,
      emailVerifyExpires: _emailVerifyExpires,
      emailVerifySentAt: _emailVerifySentAt,
      passwordResetToken: _passwordResetToken,
      passwordResetExpires: _passwordResetExpires,
      passwordResetSentAt: _passwordResetSentAt,
      failedLoginAttempts: _failedLoginAttempts,
      lockedUntil: _lockedUntil,
      providerAccountId: _providerAccountId,
      ...user
    } = updatedUser;

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-reminder-lead-days-update');
  }
});
