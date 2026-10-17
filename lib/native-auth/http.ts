import { NextResponse } from 'next/server';
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
