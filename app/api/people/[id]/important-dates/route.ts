import { prisma } from '@/lib/prisma';
import { createImportantDateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canEnableReminder } from '@/lib/billing';

// POST /api/people/[id]/important-dates - Add an important date
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(createImportantDateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const {
      title,
      date,
      reminderEnabled,
      reminderType,
      reminderInterval,
      reminderIntervalUnit,
    } = validation.data;

    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    if (reminderEnabled) {
      const reminderCheck = await canEnableReminder(session.user.id);
      if (!reminderCheck.isUnlimited && reminderCheck.current >= reminderCheck.limit) {
        return apiResponse.forbidden(
          `You have reached your reminder limit (limit: ${reminderCheck.limit}). Please upgrade to add more reminders.`
        );
      }
    }

    const importantDate = await prisma.importantDate.create({
      data: {
        personId: id,
        title,
        date: new Date(date),
        reminderEnabled: reminderEnabled ?? false,
        reminderType: reminderEnabled ? reminderType : null,
        reminderInterval: reminderEnabled && reminderType === 'RECURRING' ? reminderInterval : null,
        reminderIntervalUnit:
          reminderEnabled && reminderType === 'RECURRING' ? reminderIntervalUnit : null,
      },
    });

    return apiResponse.created({ importantDate });
  } catch (error) {
    return handleApiError(error, 'important-date-create');
  }
});
