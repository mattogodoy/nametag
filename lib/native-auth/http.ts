import { NextResponse } from 'next/server';
import type { IssuedSession } from './sessions';

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
