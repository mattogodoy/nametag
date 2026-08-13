import { prisma } from '@/lib/prisma';
import { updateImportantDateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

// PUT /api/people/[id]/important-dates/[dateId] - Update an important date
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id, dateId } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateImportantDateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { type, title, date, reminderEnabled, reminderType, reminderInterval, reminderIntervalUnit, reminderLeadDays } = validation.data;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Check for duplicate predefined type (exclude self)
    if (type) {
      const existing = await prisma.importantDate.findFirst({
        where: { personId: id, type, deletedAt: null, id: { not: dateId } },
      });
      if (existing) {
        return apiResponse.error(`A "${type}" date already exists for this person.`);
      }
    }

    // Update the important date
    const updatedDate = await prisma.importantDate.update({
      where: {
        id: dateId,
        personId: id,
      },
      data: {
        type: type ?? null,
        title,
        date: new Date(date),
        reminderEnabled: reminderEnabled ?? false,
        reminderType: reminderEnabled ? reminderType : null,
        reminderInterval: reminderEnabled && reminderType === 'RECURRING' ? reminderInterval : null,
        reminderIntervalUnit: reminderEnabled && reminderType === 'RECURRING' ? reminderIntervalUnit : null,
        reminderLeadDays: reminderEnabled ? reminderLeadDays ?? null : null,
      },
    });

    return apiResponse.ok({ importantDate: updatedDate });
  } catch (error) {
    return handleApiError(error, 'important-date-update');
  }
});

// DELETE /api/people/[id]/important-dates/[dateId] - Delete an important date
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id, dateId } = await context.params;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Soft delete the important date (set deletedAt instead of removing)
    await prisma.importantDate.update({
      where: {
        id: dateId,
        personId: id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return apiResponse.message('Important date deleted successfully');
  } catch (error) {
    return handleApiError(error, 'important-date-delete');
  }
});
