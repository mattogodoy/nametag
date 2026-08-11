import { prisma } from '@/lib/prisma';
import { updateDateFormatSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateDateFormatSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { dateFormat } = validation.data;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { dateFormat },
      // Allowlist the response. Without it Prisma returns every column, which
      // includes the password hash and live account-recovery tokens.
      select: { id: true, dateFormat: true },
    });

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-date-format-update');
  }
});
