import { cookies } from 'next/headers';
import { signIn } from '@/lib/auth';
import { env } from '@/lib/env';
import { withLogging } from '@/lib/api-utils';
import { createModuleLogger } from '@/lib/logger';
import { getLoginProviders } from '@/lib/server-info';
import { nativeBrowserStartSchema } from '@/lib/validations';
import { STATE_PATTERN } from '@/lib/native-auth/pkce';
import {
  COMPLETE_PATH,
  EXPIRED_PATH,
  PENDING_COOKIE,
  PENDING_TTL_MS,
  appRedirect,
  pendingCookieOptions,
  signPending,
} from '@/lib/native-auth/browser-cookie';

export const runtime = 'nodejs';

const log = createModuleLogger('native-auth');

/**
 * Opened by a native app in a private browser sheet. Remembers the app's
 * request in a signed cookie, then runs the normal NextAuth provider sign-in.
 */
export const GET = withLogging(async function GET(request: Request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);

  if (!query.state || !STATE_PATTERN.test(query.state)) {
    return Response.redirect(new URL(EXPIRED_PATH, env.NEXTAUTH_URL), 302);
  }
  const state = query.state;

  const parsed = nativeBrowserStartSchema.safeParse(query);
  if (!parsed.success) {
    return appRedirect({ error: 'invalid_request', state });
  }
  const { provider, code_challenge, device_name, platform, app_version } = parsed.data;

  const providers = getLoginProviders();
  const enabled = provider === 'oidc' ? providers.oidc.enabled : providers.google;
  if (!enabled) {
    log.info({ event: 'auth.native.browser.failed', provider, reason: 'provider_unavailable' }, 'Native SSO provider unavailable');
    return appRedirect({ error: 'provider_unavailable', state });
  }

  const store = await cookies();
  store.set(
    PENDING_COOKIE,
    signPending({
      provider,
      state,
      codeChallenge: code_challenge,
      device: { name: device_name, platform, appVersion: app_version },
      exp: Date.now() + PENDING_TTL_MS,
    }),
    pendingCookieOptions(PENDING_TTL_MS / 1000)
  );

  log.info({ event: 'auth.native.browser.started', provider }, 'Native SSO started');

  // NextAuth types this result as any; with redirect: false it is the provider URL.
  const providerUrl: unknown = await signIn(provider, { redirectTo: COMPLETE_PATH, redirect: false });
  if (typeof providerUrl !== 'string' || providerUrl === '') {
    log.warn({ event: 'auth.native.browser.failed', provider, reason: 'sign_in_failed' }, 'Native SSO provider URL missing');
    return appRedirect({ error: 'sign_in_failed', state });
  }
  return new Response(null, { status: 302, headers: { Location: providerUrl } });
});
