import { prisma } from '@/lib/prisma';
import { apiResponse, parseRequestBody, withLogging } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { nativeExchangeSchema, validateRequest } from '@/lib/validations';
import { consumeNativeAuthCode } from '@/lib/native-auth/codes';
import { createDeviceSession } from '@/lib/native-auth/sessions';
import { codedApiError, sessionResponse, withCode } from '@/lib/native-auth/http';

export const runtime = 'nodejs';

const log = createModuleLogger('native-auth');

const invalidCode = () => apiResponse.coded(401, 'invalid_code', 'Invalid or expired sign-in code');

/** Exchange the single-use code from the sign-in sheet for device session tokens. */
export const POST = withLogging(async function POST(request: Request) {
  const limited = checkRateLimit(request, 'nativeRefresh');
  if (limited) {
    return withCode(limited, 'rate_limited');
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(nativeExchangeSchema, body);
    if (!validation.success) {
      return withCode(validation.response, 'validation_failed');
    }

    const result = await consumeNativeAuthCode(validation.data.code, validation.data.codeVerifier);
    if (result.status !== 'ok') {
      log.info({ event: 'auth.native.browser.exchange_failed', reason: result.reason }, 'Native SSO code rejected');
      return invalidCode();
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      return invalidCode();
    }

    const session = await createDeviceSession(user.id, result.device);
    return sessionResponse(session, user);
  } catch (error) {
    return codedApiError(error, 'native-browser-exchange');
  }
});
