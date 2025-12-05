import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { auth } from './auth';
import { logger } from './logger';

/**
 * Maximum request body size in bytes (1MB default)
 * This helps prevent denial of service attacks with large payloads
 */
export const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Check if a request body exceeds the size limit
 * Returns the parsed JSON body if within limits, or throws an error if exceeded
 *
 * @example
 * const body = await parseRequestBody(request);
 * // throws if body > 1MB
 *
 * @example
 * const body = await parseRequestBody(request, 512 * 1024); // 512KB limit
 */
export async function parseRequestBody<T = unknown>(
  request: Request,
  maxSize = MAX_REQUEST_SIZE
): Promise<T> {
  // Check Content-Length header first (fast path)
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new RequestTooLargeError(maxSize);
  }

  // Clone the request to read the body
  const clonedRequest = request.clone();
  const text = await clonedRequest.text();

  // Check actual body size
  const bodySize = new TextEncoder().encode(text).length;
  if (bodySize > maxSize) {
    throw new RequestTooLargeError(maxSize);
  }

  // Parse JSON
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InvalidJsonError();
  }
}

/**
 * Custom error for request too large
 */
export class RequestTooLargeError extends Error {
  constructor(maxSize: number) {
    super(`Request body exceeds maximum size of ${Math.round(maxSize / 1024)}KB`);
    this.name = 'RequestTooLargeError';
  }
}

/**
 * Custom error for invalid JSON
 */
export class InvalidJsonError extends Error {
  constructor() {
    super('Invalid JSON in request body');
    this.name = 'InvalidJsonError';
  }
}

/**
 * Standard API response helpers
 * Provides consistent response formatting across all API endpoints
 */
export const apiResponse = {
  /**
   * Return successful response with data
   * @example apiResponse.ok({ people }) // returns { people: [...] }
   * @example apiResponse.ok({ user }, 201) // returns { user: {...} } with 201 status
   */
  ok: <T extends Record<string, unknown>>(data: T, status = 200) =>
    NextResponse.json(data, { status }),

  /**
   * Return created response (201) with data
   * @example apiResponse.created({ person }) // returns { person: {...} } with 201 status
   */
  created: <T extends Record<string, unknown>>(data: T) =>
    NextResponse.json(data, { status: 201 }),

  /**
   * Return success message
   * @example apiResponse.message('Password changed successfully')
   */
  message: (message: string, status = 200) =>
    NextResponse.json({ message }, { status }),

  /**
   * Return success with boolean flag
   * @example apiResponse.success() // returns { success: true }
   */
  success: () =>
    NextResponse.json({ success: true }),

  /**
   * Return error response
   * @example apiResponse.error('Invalid input') // returns { error: '...' } with 400 status
   */
  error: (message: string, status = 400) =>
    NextResponse.json({ error: message }, { status }),

  /**
   * Return 401 Unauthorized
   */
  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ error: message }, { status: 401 }),

  /**
   * Return 403 Forbidden
   */
  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message }, { status: 403 }),

  /**
   * Return 404 Not Found
   */
  notFound: (message = 'Not found') =>
    NextResponse.json({ error: message }, { status: 404 }),

  /**
   * Return 413 Payload Too Large
   */
  payloadTooLarge: (message = 'Request body too large') =>
    NextResponse.json({ error: message }, { status: 413 }),

  /**
   * Return 500 Internal Server Error
   */
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
  // Handle specific error types with appropriate status codes
  if (error instanceof RequestTooLargeError) {
    logger.warn(`Request too large in ${context}`, { context, ...additionalInfo });
    return apiResponse.payloadTooLarge(error.message);
  }

  if (error instanceof InvalidJsonError) {
    logger.warn(`Invalid JSON in ${context}`, { context, ...additionalInfo });
    return apiResponse.error(error.message);
  }

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
