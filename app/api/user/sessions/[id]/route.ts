import { apiResponse, withAuth } from '@/lib/api-utils';
import { revokeDeviceSession } from '@/lib/native-auth/sessions';

/** Sign out one native app. Scoped to the caller's own devices. */
export const DELETE = withAuth(async (_request, session, context) => {
  const { id } = await context.params;
  const revoked = await revokeDeviceSession(session.user.id, id);
  if (!revoked) {
    return apiResponse.notFound('Device not found');
  }
  return new Response(null, { status: 204 });
}, { allowApiTokens: false });
