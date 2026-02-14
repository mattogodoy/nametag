import { prisma } from '@/lib/prisma';
import { createImportantDateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { canEnableReminder } from '@/lib/billing';

// GET /api/people/[id]/important-dates - List important dates for a person
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    const importantDates = await prisma.importantDate.findMany({
      where: { personId: id, deletedAt: null },
      orderBy: { date: 'asc' },
    });

    return apiResponse.ok({ importantDates });
  } catch (error) {
    return handleApiError(error, 'important-dates-list');
  }
});

// POST /api/people/[id]/important-dates - Create a new important date for a person
export const POST = withAuth(async (request, session, context) => {
  try {
    const { id } = await context!.params;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(createImportantDateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { title, date, reminderEnabled, reminderType, reminderInterval, reminderIntervalUnit } = validation.data;

    // Check reminder limits if enabling a reminder
    if (reminderEnabled) {
      const reminderCheck = await canEnableReminder(session.user.id);
      if (!reminderCheck.isUnlimited) {
        const remainingSlots = reminderCheck.limit - reminderCheck.current;
        if (remainingSlots <= 0) {
          return apiResponse.forbidden(
            `You've reached your plan limit of ${reminderCheck.limit} reminders. ` +
            `Please upgrade your plan to add more.`
          );
        }
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
        reminderIntervalUnit: reminderEnabled && reminderType === 'RECURRING' ? reminderIntervalUnit : null,
      },
    });

    return apiResponse.created({ importantDate });
  } catch (error) {
    return handleApiError(error, 'important-dates-create');
  }
});
