import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export function proxy(request: NextRequest) {
  const startTime = Date.now();
  const { pathname, search } = request.nextUrl;
  const method = request.method;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';

  // Create response
  const response = NextResponse.next();

  // Log the request
  response.headers.set('x-request-id', crypto.randomUUID());

  // Log after response (this runs on every request)
  const duration = Date.now() - startTime;

  // Log based on status (we'll check this in the response)
  // For now, log all requests in development
  if (process.env.NODE_ENV === 'development') {
    logger.info(`${method} ${pathname}${search}`, {
      method,
      path: pathname,
      query: search,
      ip,
      userAgent,
      duration: `${duration}ms`,
    });
  }

  return response;
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * But DO match API routes and public assets to log them
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

