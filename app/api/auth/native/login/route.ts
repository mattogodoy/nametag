import { authorizeCredentials } from '@/lib/auth';
import { apiResponse, handleApiError, parseRequestBody, withLogging } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { isFeatureEnabled } from '@/lib/features';
import { nativeLoginSchema, validateRequest } from '@/lib/validations';
import { createDeviceSession } from '@/lib/native-auth/sessions';
import { sessionResponse, withCode } from '@/lib/native-auth/http';

export const runtime = 'nodejs';

/**
 * Password sign-in for native apps. Returns an access and refresh token pair
 * instead of a cookie. Lockout, email verification and the OAuth-only rule
 * come from authorizeCredentials, so they match the web exactly.
 */
export const POST = withLogging(async function POST(request: Request) {
  const limited = checkRateLimit(request, 'login');
  if (limited) {
    return withCode(limited, 'rate_limited');
  }

  if (!isFeatureEnabled('passwordLogin')) {
    return apiResponse.coded(403, 'password_login_disabled', 'Password login is disabled on this server');
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(nativeLoginSchema, body);
    if (!validation.success) {
      return withCode(validation.response, 'validation_failed');
    }
    const { email, password, device } = validation.data;

    let user: Awaited<ReturnType<typeof authorizeCredentials>>;
    try {
      user = await authorizeCredentials({ email, password });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'ACCOUNT_LOCKED') {
        return apiResponse.coded(403, 'account_locked', 'Account temporarily locked after too many failed attempts');
      }
      if (message === 'EMAIL_NOT_VERIFIED') {
        return apiResponse.coded(403, 'email_not_verified', 'Email address not verified');
      }
      throw error;
    }

    if (!user) {
      return apiResponse.coded(401, 'invalid_credentials', 'Invalid email or password');
    }

    const session = await createDeviceSession(user.id, device);
    return sessionResponse(session, { id: user.id, email: user.email, name: user.name });
  } catch (error) {
    return handleApiError(error, 'native-login');
  }
});
