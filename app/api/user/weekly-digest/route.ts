import { prisma } from '@/lib/prisma';
import { updateWeeklyDigestSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateWeeklyDigestSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { enabled, weekday } = validation.data;

    // select is an allowlist: only these three columns can ever reach the
    // response, so the password hash and other sensitive columns never
    // enter process memory for this request in the first place.
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { weeklyDigestEnabled: enabled, weeklyDigestWeekday: weekday },
      select: { id: true, weeklyDigestEnabled: true, weeklyDigestWeekday: true },
    });

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-weekly-digest-update');
  }
});
