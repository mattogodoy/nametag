import { createEventSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { createEvent, getEvents, InvalidEventPeopleError } from '@/lib/services/event';

// GET /api/events - List all events for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const events = await getEvents(session.user.id);
    return apiResponse.ok({ events });
  } catch (error) {
    return handleApiError(error, 'events-list');
  }
});

// POST /api/events - Create a new event
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createEventSchema, body);
    if (!validation.success) return validation.response;

    const event = await createEvent(session.user.id, validation.data);
    return apiResponse.created({ event });
  } catch (error) {
    if (error instanceof InvalidEventPeopleError) {
      return apiResponse.error(error.message, 400);
    }
    return handleApiError(error, 'events-create');
  }
});
