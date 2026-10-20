import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withLogging } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { nativeRefreshSchema, validateRequest } from '@/lib/validations';
import { refreshDeviceSession } from '@/lib/native-auth/sessions';
import { sessionResponse } from '@/lib/native-auth/http';

export const runtime = 'nodejs';

const sessionExpired = () =>
  apiResponse.coded('session_expired', 'Session expired. Please sign in again.');

/** Exchange a refresh token for a new access and refresh token pair. */
export const POST = withLogging(async function POST(request: Request) {
  const limited = checkRateLimit(request, 'nativeRefresh');
  if (limited) {
    return limited;
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(nativeRefreshSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const result = await refreshDeviceSession(validation.data.refreshToken);
    if (result.status !== 'ok') {
      return sessionExpired();
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return sessionExpired();
    }

    return sessionResponse(result.session, user);
  } catch (error) {
    return handleApiError(error, 'native-refresh');
  }
});
