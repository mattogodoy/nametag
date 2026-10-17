import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { withLogging } from '@/lib/api-utils';
import { createModuleLogger } from '@/lib/logger';
import { issueNativeAuthCode } from '@/lib/native-auth/codes';
import { decodeWebSessionToken, endWebSession } from '@/lib/native-auth/web-session';
import {
  EXPIRED_PATH,
  PENDING_COOKIE,
  PENDING_TTL_MS,
  REASON_COOKIE,
  appRedirect,
  parseReason,
  verifyPending,
} from '@/lib/native-auth/browser-cookie';

export const runtime = 'nodejs';

const log = createModuleLogger('native-auth');

/**
 * Where NextAuth returns after the provider sign-in (and where /login forwards
 * on a provider error). Turns the fresh web session into a single-use code.
 */
export const GET = withLogging(async function GET(request: Request) {
  const store = await cookies();
  const pending = verifyPending(store.get(PENDING_COOKIE)?.value);
  const reason = parseReason(store.get(REASON_COOKIE)?.value);
  store.delete(PENDING_COOKIE);
  store.delete(REASON_COOKIE);

  if (!pending) {
    return Response.redirect(new URL(EXPIRED_PATH, env.NEXTAUTH_URL), 302);
  }

  // This route is a cross-site provider redirect, so it cannot use withAuth
  // (no same-origin check is possible). The gate is the signed, SameSite=Lax
  // pending cookie verified above. The session must also have been created by
  // this flow, so a pre-existing web session in a shared cookie jar is never
  // turned into a code: its sign-in time must not predate the pending cookie.
  const token = await decodeWebSessionToken(request);
  const flowStart = Math.floor((pending.exp - PENDING_TTL_MS) / 1000);
  const userId =
    token && typeof token.id === 'string' && typeof token.authTime === 'number' && token.authTime >= flowStart
      ? token.id
      : null;
  if (!userId) {
    const error = reason ?? 'sign_in_failed';
    log.info({ event: 'auth.native.browser.failed', provider: pending.provider, reason: error }, 'Native SSO failed');
    return appRedirect({ error, state: pending.state });
  }

  const code = await issueNativeAuthCode(userId, pending);
  await endWebSession(request);

  log.info(
    { event: 'auth.native.browser.completed', provider: pending.provider, userId },
    'Native SSO completed'
  );
  return appRedirect({ code, state: pending.state });
});
