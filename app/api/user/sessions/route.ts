import { apiResponse, withAuth } from '@/lib/api-utils';
import { listDeviceSessions, revokeOtherDeviceSessions } from '@/lib/native-auth/sessions';

/** List the user's signed-in native apps. */
export const GET = withAuth(async (_request, session) => {
  const rows = await listDeviceSessions(session.user.id);
  return apiResponse.ok({
    sessions: rows.map((row) => ({
      id: row.id,
      name: row.name,
      platform: row.platform,
      appVersion: row.appVersion,
      lastUsedAt: row.lastUsedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      current: row.id === session.deviceSessionId,
    })),
  });
}, { allowApiTokens: false });

/** Sign out every native app except the calling one. */
export const DELETE = withAuth(async (_request, session) => {
  await revokeOtherDeviceSessions(session.user.id, session.deviceSessionId ?? null);
  return new Response(null, { status: 204 });
}, { allowApiTokens: false });
