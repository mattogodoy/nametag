import { discoverNewContacts } from '@/lib/carddav/discover';
import { createModuleLogger } from '@/lib/logger';
import { apiResponse, withAuth } from '@/lib/api-utils';

const log = createModuleLogger('carddav');

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
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Discovery failed');

    return apiResponse.ok(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
      },
      500
    );
  }
});
