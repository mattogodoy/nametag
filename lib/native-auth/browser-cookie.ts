import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import { nativeDeviceSchema } from '@/lib/validations';
import { CHALLENGE_PATTERN, STATE_PATTERN } from './pkce';
import type { DeviceInfo } from './sessions';

export const PENDING_COOKIE = 'nametag-native-auth';
export const REASON_COOKIE = 'nametag-native-auth-error';
export const PENDING_TTL_MS = 10 * 60 * 1000;
export const NATIVE_REDIRECT_URI = 'nametag://auth/callback';
export const COMPLETE_PATH = '/api/auth/native/browser/complete';
export const EXPIRED_PATH = '/native-auth/expired';

export type NativeAuthProvider = 'oidc' | 'google';
export type SheetErrorCode =
  | 'invalid_request'
  | 'provider_unavailable'
  | 'email_not_verified'
  | 'account_linked_elsewhere'
  | 'sign_in_failed';

export interface PendingNativeAuth {
  provider: NativeAuthProvider;
  state: string;
  codeChallenge: string;
  device: DeviceInfo;
  exp: number;
}

const pendingSchema = z.object({
  provider: z.enum(['oidc', 'google']),
  state: z.string().regex(STATE_PATTERN),
  codeChallenge: z.string().regex(CHALLENGE_PATTERN),
  device: nativeDeviceSchema,
  exp: z.number(),
});

function signingKey(): Buffer {
  return createHmac('sha256', env.NEXTAUTH_SECRET).update('native-auth-cookie').digest();
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function signPending(pending: PendingNativeAuth): string {
  const payload = Buffer.from(JSON.stringify(pending)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyPending(value: string | undefined, now: number = Date.now()): PendingNativeAuth | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const parsed = pendingSchema.safeParse(decoded);
  if (!parsed.success || parsed.data.exp <= now) return null;
  return parsed.data;
}

/**
 * Secure follows the public URL's scheme, not NODE_ENV, so a self-hosted
 * production server on plain http (a LAN) still receives the cookie.
 */
export function pendingCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: env.NEXTAUTH_URL.startsWith('https:'),
    path: '/' as const,
    maxAge: maxAgeSeconds,
  };
}

/** 302 to the app. The target is fixed; params are only ever query values. */
export function appRedirect(params: Record<string, string>): Response {
  const url = new URL(NATIVE_REDIRECT_URI);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export function parseReason(value: string | undefined): SheetErrorCode | null {
  return value === 'email_not_verified' || value === 'account_linked_elsewhere' ? value : null;
}

/**
 * Called from the NextAuth signIn path just before it rejects a login. NextAuth
 * reduces the thrown error to `AccessDenied`, so the reason is carried in a
 * short cookie for the native handoff. No-op for web sign-ins and outside a
 * request scope.
 */
export async function recordNativeAuthFailure(
  reason: 'email_not_verified' | 'account_linked_elsewhere'
): Promise<void> {
  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    if (!store.has(PENDING_COOKIE)) return;
    store.set(REASON_COOKIE, reason, pendingCookieOptions(60));
  } catch {
    // Not in a request scope (tests, scripts): nothing to record.
  }
}
