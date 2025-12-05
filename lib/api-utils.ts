import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { auth } from './auth';
import { logger } from './logger';

/**
 * Standard API response helpers
 */
export const apiResponse = {
  success: <T>(data: T, status = 200) =>
    NextResponse.json({ data }, { status }),

  created: <T>(data: T) =>
    NextResponse.json({ data }, { status: 201 }),

  message: (message: string, status = 200) =>
    NextResponse.json({ message }, { status }),

  error: (message: string, status = 400) =>
    NextResponse.json({ error: message }, { status }),

  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ error: message }, { status: 401 }),

  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message }, { status: 403 }),

  notFound: (message = 'Not found') =>
    NextResponse.json({ error: message }, { status: 404 }),

  serverError: (message = 'Internal server error') =>
    NextResponse.json({ error: message }, { status: 500 }),
};

/**
 * Handle API errors consistently
 * Logs the error and returns an appropriate response
 */
export function handleApiError(
  error: unknown,
  context: string,
  additionalInfo?: Record<string, unknown>
): NextResponse {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error(`API Error in ${context}`, {
    context,
    ...additionalInfo,
  }, errorObj);

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong'
    : errorObj.message;

  return apiResponse.serverError(message);
}

/**
 * Get client IP from request for logging purposes
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Session with guaranteed user (for authenticated handlers)
 */
export interface AuthenticatedSession extends Session {
  user: Session['user'] & { id: string };
}

/**
 * Route context for dynamic routes with params
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Handler function type for authenticated API routes
 */
export type AuthenticatedHandler<T = Response | NextResponse> = (
  request: Request,
  session: AuthenticatedSession,
  context?: RouteContext
) => Promise<T>;

/**
 * Higher-order function that wraps API handlers with authentication
 * Automatically checks for valid session and returns 401 if not authenticated
 *
 * @example
 * // Simple usage
 * export const GET = withAuth(async (request, session) => {
 *   const userId = session.user.id;
 *   // ... handler logic
 *   return NextResponse.json({ data });
 * });
 *
 * // With route params
 * export const GET = withAuth(async (request, session, context) => {
 *   const { id } = await context!.params;
 *   // ... handler logic
 *   return NextResponse.json({ data });
 * });
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: Request,
    context?: RouteContext
  ): Promise<Response | NextResponse> => {
    const session = await auth();

    if (!session?.user?.id) {
      return apiResponse.unauthorized();
    }

    return handler(request, session as AuthenticatedSession, context);
  };
}
