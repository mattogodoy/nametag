import { NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { randomUUID } from 'node:crypto';
import { auth } from './auth';
import { apiError, genericCodeFor, type ApiErrorCode, type ApiErrorParams } from '@/lib/api-errors';
import { logger, createModuleLogger } from './logger';
import { validateOrigin } from '@/lib/csrf';
import { runWithContext, updateContext } from '@/lib/logging/context';
import { resolveApiToken } from '@/lib/api-tokens';
import { resolveDeviceAccessToken } from '@/lib/native-auth/sessions';
import { ACCESS_TOKEN_PREFIX } from '@/lib/native-auth/tokens';
import {
  resolveTrustedClientIp,
  getRawTrustedProxyHeaderForLogging,
} from '@/lib/net/client-ip';

/** HTTP methods that read but never mutate. Allowed for read-only API tokens. */
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Extract a bearer token from the Authorization header, or null if absent. */
function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

const httpLog = createModuleLogger('http');

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
   * Return an error with a machine-readable code for native clients
   * The status comes from the catalog in lib/api-errors.ts.
   * @example apiResponse.coded('session_expired', 'Session expired')
   */
  coded: (code: ApiErrorCode, message: string, params?: ApiErrorParams) =>
    apiError(code, message, params),

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
    NextResponse.json({ error: message, code: genericCodeFor(status) }, { status }),

  /**
   * Return 401 Unauthorized
   */
  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ error: message, code: genericCodeFor(401) }, { status: 401 }),

  /**
   * Return 403 Forbidden
   */
  forbidden: (message = 'Forbidden') =>
    NextResponse.json({ error: message, code: genericCodeFor(403) }, { status: 403 }),

  /**
   * Return 404 Not Found
   */
  notFound: (message = 'Not found') =>
    NextResponse.json({ error: message, code: genericCodeFor(404) }, { status: 404 }),

  /**
   * Return 413 Payload Too Large
   */
  payloadTooLarge: (message = 'Request body too large') =>
    NextResponse.json({ error: message, code: genericCodeFor(413) }, { status: 413 }),

  /**
   * Return 500 Internal Server Error
   */
  serverError: (message = 'Internal server error') =>
    NextResponse.json({ error: message, code: genericCodeFor(500) }, { status: 500 }),
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
    logger.warn({ context, ...additionalInfo }, `Request too large in ${context}`);
    return apiError('payload_too_large', error.message);
  }

  if (error instanceof InvalidJsonError) {
    logger.warn({ context, ...additionalInfo }, `Invalid JSON in ${context}`);
    return apiError('invalid_json', error.message);
  }

  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Detect database connection errors - return friendly message in all environments
  const isDbConnectionError =
    (typeof error === 'object' && error !== null && 'code' in error &&
      ((error as Record<string, unknown>).code === 'ECONNREFUSED' ||
        (error as Record<string, unknown>).code === 'ETIMEDOUT' ||
        (error as Record<string, unknown>).code === 'ENOTFOUND')) ||
    errorObj.message.includes('ECONNREFUSED') ||
    errorObj.message.includes('Can\'t reach database server');

  if (isDbConnectionError) {
    logger.error({ err: errorObj, context, ...additionalInfo }, `Database connection error in ${context}`);
    return apiError('service_unavailable', 'Service temporarily unavailable. Please try again later.');
  }

  logger.error({ err: errorObj, context, ...additionalInfo }, `API Error in ${context}`);

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Something went wrong'
    : errorObj.message;

  return apiError('internal_error', message);
}

/**
 * Normalize email address to lowercase for consistent storage and lookup
 * Prevents case-sensitivity issues where Bob@test.com and bob@test.com
 * would be treated as different users
 *
 * @example
 * normalizeEmail('Bob@Test.COM') // returns 'bob@test.com'
 * normalizeEmail('user@DOMAIN.com') // returns 'user@domain.com'
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Session with guaranteed user (for authenticated handlers)
 */
export interface AuthenticatedSession extends Session {
  user: Session['user'] & { id: string };
  /** How this request authenticated. Absent only in legacy test doubles. */
  authMethod?: 'session' | 'apiToken' | 'device';
  /** Set when authMethod is 'device'. */
  deviceSessionId?: string;
}

/**
 * Route context for dynamic routes with params
 */
export interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * Handler function type for authenticated API routes.
 * Context is always typed as required so that dynamic route handlers
 * get proper type inference without non-null assertions.
 * Handlers that don't need params can simply omit the third parameter.
 */
export type AuthenticatedHandler = (
  request: Request,
  session: AuthenticatedSession,
  context: RouteContext,
) => Promise<Response | NextResponse>;

/**
 * Higher-order function that wraps API handlers with request-level HTTP logging.
 * Logs method, path, status, duration, and client IP for every request.
 * On success, logs at info level; on unhandled throw, logs at error level and re-throws.
 *
 * The generic signature preserves the handler's parameter types so that
 * Next.js route-type validation (`.next/types/validator.ts`) sees the
 * original handler shape, not a narrowed `(Request, RouteContext?)` type.
 *
 * @example
 * export const GET = withLogging(async (request) => {
 *   return NextResponse.json({ ok: true });
 * });
 */
export function withLogging<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Args extends [Request, ...any[]],
  R extends Response | NextResponse,
>(
  handler: (...args: Args) => Promise<R>
): (...args: Args) => Promise<R> {
  return (...args: Args): Promise<R> =>
    runWithContext({ requestId: randomUUID() }, async () => {
      const request = args[0];
      const start = Date.now();
      const method = request.method;
      const path = new URL(request.url).pathname;

      // The logged `ip` field must be the value the app actually trusted
      // for rate limiting, not a client-supplied best-effort guess: a log
      // line claiming to record "the client" while actually recording
      // whatever the client typed is worse than no field at all, since it
      // looks trustworthy without being trustworthy. When resolution fails,
      // 'unknown' matches the fallback already used for the same case in
      // lib/rate-limit-redis.ts's securityLogger argument, so there is one
      // convention for "no trusted IP" across logs rather than two. The raw
      // header is attached only in that failure case (see
      // getRawTrustedProxyHeaderForLogging): it is exactly the untrusted
      // value resolution rejected, useful for diagnosing a wrong
      // TRUSTED_PROXY_COUNT or TRUSTED_PROXY_HEADER, and would be pure noise
      // (and a log-flooding vector, since a client controls its length) on
      // every request that resolves normally.
      const trustedIp = resolveTrustedClientIp(request);
      const ip = trustedIp ?? 'unknown';
      const rawProxyHeader =
        trustedIp === null ? getRawTrustedProxyHeaderForLogging(request) : undefined;
      const diagnosticFields =
        rawProxyHeader !== undefined ? { rawProxyHeader } : {};

      try {
        const response = await handler(...args);
        httpLog.info(
          {
            event: 'http.request.completed',
            method,
            path,
            status: response.status,
            durationMs: Date.now() - start,
            ip,
            ...diagnosticFields,
          },
          `${method} ${path} ${response.status}`
        );
        return response;
      } catch (error) {
        httpLog.error(
          {
            event: 'http.request.failed',
            method,
            path,
            status: 500,
            durationMs: Date.now() - start,
            ip,
            ...diagnosticFields,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          `${method} ${path} 500`
        );
        throw error;
      }
    });
}

/**
 * Higher-order function that wraps API handlers with authentication.
 * Automatically checks for valid session and returns 401 if not authenticated.
 *
 * @example
 * // Without route params
 * export const GET = withAuth(async (request, session) => {
 *   const userId = session.user.id;
 *   return NextResponse.json({ data });
 * });
 *
 * // With route params (context is required, no need for non-null assertion)
 * export const GET = withAuth(async (request, session, context) => {
 *   const { id } = await context.params;
 *   return NextResponse.json({ data });
 * });
 */
/**
 * Options for {@link withAuth}.
 */
export interface WithAuthOptions {
  /**
   * Whether personal API tokens (`ntag_`) are accepted on this route. Defaults
   * to true. Set to false for sensitive routes that must not be reachable from
   * a script's long-lived token, e.g. API-token management itself.
   *
   * Native app device sessions (`ntsa_`) are interactive sign-ins and are
   * accepted regardless of this option.
   */
  allowApiTokens?: boolean;
}

export function withAuth(
  handler: AuthenticatedHandler,
  options: WithAuthOptions = {}
) {
  const allowApiTokens = options.allowApiTokens !== false;

  return withLogging(async (
    request: Request,
    context?: RouteContext
  ): Promise<Response | NextResponse> => {
    const bearer = extractBearerToken(request);

    // Native app device session. Bearer auth is not subject to CSRF, so the
    // Origin check is skipped.
    if (bearer && bearer.startsWith(ACCESS_TOKEN_PREFIX)) {
      const resolved = await resolveDeviceAccessToken(bearer);
      if (resolved.status === 'expired') {
        return apiResponse.coded('access_token_expired', 'Access token expired');
      }
      if (resolved.status === 'invalid') {
        return apiResponse.coded('invalid_token', 'Invalid token');
      }

      updateContext({ userId: resolved.userId });

      const deviceSession = {
        user: { id: resolved.userId },
        authMethod: 'device',
        deviceSessionId: resolved.sessionId,
      } as AuthenticatedSession;

      return handler(request, deviceSession, context as RouteContext);
    }

    // Personal API token: for programmatic clients and MCP servers.
    if (bearer && allowApiTokens) {
      const resolved = await resolveApiToken(bearer);

      if (!resolved) {
        return apiResponse.coded('invalid_token', 'Invalid or expired API token');
      }

      // Read-only tokens may only perform safe (non-mutating) requests.
      if (resolved.scope === 'READ' && !READ_ONLY_METHODS.has(request.method)) {
        return apiResponse.forbidden('This API token is read-only');
      }

      updateContext({ userId: resolved.userId });

      const tokenSession = {
        user: { id: resolved.userId },
        authMethod: 'apiToken',
      } as AuthenticatedSession;

      return handler(request, tokenSession, context as RouteContext);
    }

    // Session (cookie) auth path.
    if (!validateOrigin(request)) {
      return apiError('invalid_origin', 'Invalid request origin');
    }

    const session = await auth();

    if (!session?.user?.id) {
      return apiResponse.unauthorized();
    }

    updateContext({ userId: session.user.id });

    return handler(
      request,
      { ...(session as AuthenticatedSession), authMethod: 'session' },
      context as RouteContext
    );
  });
}
