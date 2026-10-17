import { apiResponse, withAuth } from '@/lib/api-utils';
import { revokeDeviceSession } from '@/lib/native-auth/sessions';

/** Sign out the calling native app. Requires a device access token. */
export const POST = withAuth(async (_request, session) => {
  if (session.authMethod !== 'device' || !session.deviceSessionId) {
    return apiResponse.coded(400, 'not_a_device_session', 'Only a native app session can log out here');
  }
  await revokeDeviceSession(session.user.id, session.deviceSessionId);
  return new Response(null, { status: 204 });
});
