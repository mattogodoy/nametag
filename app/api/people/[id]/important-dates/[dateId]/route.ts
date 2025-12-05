import { prisma } from '@/lib/prisma';
import { updateImportantDateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

// PUT /api/people/[id]/important-dates/[dateId] - Update an important date
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id, dateId } = await context!.params;
    const body = await request.json();
    const validation = validateRequest(updateImportantDateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { title, date, reminderEnabled, reminderType, reminderInterval, reminderIntervalUnit } = validation.data;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Update the important date
    const updatedDate = await prisma.importantDate.update({
      where: {
        id: dateId,
        personId: id,
      },
      data: {
        title,
        date: new Date(date),
        reminderEnabled: reminderEnabled ?? false,
        reminderType: reminderEnabled ? reminderType : null,
        reminderInterval: reminderEnabled && reminderType === 'RECURRING' ? reminderInterval : null,
        reminderIntervalUnit: reminderEnabled && reminderType === 'RECURRING' ? reminderIntervalUnit : null,
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
    const { id, dateId } = await context!.params;

    // Check if person exists and belongs to user
    const person = await prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!person) {
      return apiResponse.notFound('Person not found');
    }

    // Delete the important date
    await prisma.importantDate.delete({
      where: {
        id: dateId,
        personId: id,
      },
    });

    return apiResponse.message('Important date deleted successfully');
  } catch (error) {
    return handleApiError(error, 'important-date-delete');
  }
});
