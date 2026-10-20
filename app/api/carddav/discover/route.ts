import { discoverNewContacts } from '@/lib/carddav/discover';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

export const POST = withAuth(async (_request, session) => {
  try {
    // Discover new contacts
    const result = await discoverNewContacts(session.user.id);

    return apiResponse.ok({
      success: true,
      discovered: result.discovered,
      errors: result.errors,
      errorMessages: result.errorMessages,
    });
  } catch (error) {
    return handleApiError(error, 'carddav-discover');
  }
});
