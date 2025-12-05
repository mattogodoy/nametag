import { NextResponse } from 'next/server';
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
