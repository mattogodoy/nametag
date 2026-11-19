import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import { env } from '@/lib/env';
import { blacklistToken } from '@/lib/token-blacklist';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('native-auth');

const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isHttpsDeployment(): boolean {
  return new URL(env.NEXTAUTH_URL).protocol === 'https:';
}

/** Decode the NextAuth session JWT carried by the request, or null. */
export async function decodeWebSessionToken(request: Request): Promise<JWT | null> {
  return getToken({ req: request, secret: env.NEXTAUTH_SECRET, secureCookie: isHttpsDeployment() });
}

/**
 * End the web session the sign-in sheet just created: blacklist its JWT (as
 * logout does) and delete the session cookie and any chunks.
 */
export async function endWebSession(request: Request): Promise<void> {
  const store = await cookies();

  try {
    const token = await decodeWebSessionToken(request);
    if (token?.jti) {
      const expiresAt = new Date(typeof token.exp === 'number' ? token.exp * 1000 : Date.now() + THIRTY_DAYS_MS);
      await blacklistToken(token.jti, expiresAt);
    }
  } catch (error) {
    log.warn({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to blacklist handoff web session');
  }

  for (const cookie of store.getAll()) {
    if (SESSION_COOKIE.test(cookie.name)) {
      // Browsers only honour a deletion that matches the cookie's attributes;
      // a __Secure- cookie must be cleared with Secure and the same path.
      store.set(cookie.name, '', {
        maxAge: 0,
        path: '/',
        secure: cookie.name.startsWith('__Secure-'),
        httpOnly: true,
        sameSite: 'lax',
      });
    }
  }
}
