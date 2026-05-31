import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { revokeApiToken } from '@/lib/api-tokens';

export const DELETE = withAuth(
  async (_request, session, context) => {
    try {
      const { id } = await context.params;
      const revoked = await revokeApiToken(session.user.id, id);

      if (!revoked) {
        return apiResponse.notFound('API token not found');
      }

      return apiResponse.success();
    } catch (error) {
      return handleApiError(error, 'api-tokens-revoke');
    }
  },
  { allowApiToken: false }
);
