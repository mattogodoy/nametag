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

    // select is an allowlist: only these two columns can ever reach the
    // response, so the password hash and other sensitive columns never
    // enter process memory for this request in the first place.
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { defaultReminderLeadDays: days },
      select: { id: true, defaultReminderLeadDays: true },
    });

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-reminder-lead-days-update');
  }
});
