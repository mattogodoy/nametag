import { updateEventSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { getEvent, updateEvent, deleteEvent, InvalidEventPeopleError } from '@/lib/services/event';

// GET /api/events/[id]
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;
    const event = await getEvent(session.user.id, id);
    if (!event) return apiResponse.notFound('Event not found');
    return apiResponse.ok({ event });
  } catch (error) {
    return handleApiError(error, 'events-get');
  }
});

// PUT /api/events/[id]
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateEventSchema, body);
    if (!validation.success) return validation.response;

    const event = await updateEvent(session.user.id, id, validation.data);
    if (!event) return apiResponse.notFound('Event not found');
    return apiResponse.ok({ event });
  } catch (error) {
    if (error instanceof InvalidEventPeopleError) {
      return apiResponse.error(error.message, 400);
    }
    return handleApiError(error, 'events-update');
  }
});

// DELETE /api/events/[id]
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;
    const result = await deleteEvent(session.user.id, id);
    if (!result) return apiResponse.notFound('Event not found');
    return apiResponse.ok({ success: true });
  } catch (error) {
    return handleApiError(error, 'events-delete');
  }
});
