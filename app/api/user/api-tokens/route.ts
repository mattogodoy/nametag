import {
  apiResponse,
  handleApiError,
  parseRequestBody,
  withAuth,
} from '@/lib/api-utils';
import { createApiTokenSchema, validateRequest } from '@/lib/validations';
import { createApiToken, listApiTokens } from '@/lib/api-tokens';

// Token management is intentionally session-only (allowApiToken: false) so an
// API token can never be used to mint or enumerate other tokens.

export const GET = withAuth(
  async (_request, session) => {
    try {
      const tokens = await listApiTokens(session.user.id);
      return apiResponse.ok({ tokens });
    } catch (error) {
      return handleApiError(error, 'api-tokens-list');
    }
  },
  { allowApiToken: false }
);

export const POST = withAuth(
  async (request, session) => {
    try {
      const body = await parseRequestBody(request);
      const validation = validateRequest(createApiTokenSchema, body);

      if (!validation.success) {
        return validation.response;
      }

      const { name, scope, expiresAt } = validation.data;

      const created = await createApiToken({
        userId: session.user.id,
        name,
        scope,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      // The plaintext `token` field is returned here exactly once.
      return apiResponse.created({ apiToken: created });
    } catch (error) {
      return handleApiError(error, 'api-tokens-create');
    }
  },
  { allowApiToken: false }
);
