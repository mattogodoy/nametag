import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleApiError, parseRequestBody, withLogging } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Client-side error logging endpoint
 * Allows the browser to send errors to the server for logging
 *
 * Unauthenticated by necessity: an error that breaks the session still needs to
 * be reportable. Everything written to the log is therefore treated as
 * untrusted input. Reports are rate limited per IP, the body is capped, and
 * each field is accepted only if it is a string and then truncated, so a caller
 * cannot flood the log or shape it with arbitrary structures.
 */

/** Reports are small; anything larger is not a genuine error report. */
const MAX_REPORT_SIZE = 64 * 1024;

const FIELD_LIMITS = {
  message: 1024,
  stack: 8192,
  digest: 256,
  url: 2048,
  userAgent: 512,
} as const;

interface ErrorReport {
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  url?: unknown;
  userAgent?: unknown;
}

/**
 * Accept a field only if the client sent a string, and cap its length.
 * Non-string values (objects, arrays, numbers) are dropped rather than
 * coerced, so the log keeps a predictable shape.
 */
function takeString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export const POST = withLogging(async function POST(request: Request) {
  const rateLimitResponse = checkRateLimit(request, 'clientErrorLog');
  if (rateLimitResponse) return rateLimitResponse;

  let report: ErrorReport;
  try {
    report = await parseRequestBody<ErrorReport>(request, MAX_REPORT_SIZE);
  } catch (error) {
    return handleApiError(error, 'log-error');
  }

  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  logger.error(
    {
      message: takeString(report.message, FIELD_LIMITS.message),
      stack: takeString(report.stack, FIELD_LIMITS.stack),
      digest: takeString(report.digest, FIELD_LIMITS.digest),
      url: takeString(report.url, FIELD_LIMITS.url),
      userAgent:
        takeString(report.userAgent, FIELD_LIMITS.userAgent) ??
        takeString(request.headers.get('user-agent'), FIELD_LIMITS.userAgent),
      ip,
    },
    'Client-side error'
  );

  return NextResponse.json({ success: true });
});
