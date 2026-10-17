import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';
import type { IssuedSession } from './sessions';

/**
 * Add a machine-readable `code` to an existing JSON error response, keeping
 * its status and headers (e.g. Retry-After on a 429).
 */
export async function withCode(res: Response, code: string): Promise<Response> {
  const body: unknown = await res.json();
  const fields = typeof body === 'object' && body !== null ? body : {};
  // NextResponse.json spreads init.headers, which silently drops a Headers
  // instance, so copy the entries into a plain object first. The old
  // content-length no longer matches the rewritten body.
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (key !== 'content-length') headers[key] = value;
  });
  return NextResponse.json({ ...fields, code }, { status: res.status, headers });
}

export function sessionResponse(
  session: IssuedSession,
  user: { id: string; email: string; name: string }
): NextResponse {
  return NextResponse.json({
    accessToken: session.accessToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt.toISOString(),
    refreshToken: session.refreshToken,
    sessionId: session.sessionId,
    user,
  });
}

/**
 * Run an unexpected error through handleApiError and add a machine-readable
 * `code`, so every error on the native endpoints carries one.
 */
export async function codedApiError(error: unknown, context: string): Promise<Response> {
  const res = handleApiError(error, context);
  const codes: Record<number, string> = {
    400: 'validation_failed',
    413: 'payload_too_large',
    503: 'service_unavailable',
  };
  return withCode(res, codes[res.status] ?? 'internal_error');
}
