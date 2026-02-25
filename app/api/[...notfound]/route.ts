import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';

/**
 * Catch-all route handler for unmatched API routes
 * This helps us log 404s for API endpoints
 */
export const GET = withLogging(async function GET(request: Request) {
  const pathname = new URL(request.url).pathname;

  logger.warn({
    method: 'GET',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
});

export const POST = withLogging(async function POST(request: Request) {
  const pathname = new URL(request.url).pathname;

  logger.warn({
    method: 'POST',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
});

export const PUT = withLogging(async function PUT(request: Request) {
  const pathname = new URL(request.url).pathname;

  logger.warn({
    method: 'PUT',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
});

export const DELETE = withLogging(async function DELETE(request: Request) {
  const pathname = new URL(request.url).pathname;

  logger.warn({
    method: 'DELETE',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
});

export const PATCH = withLogging(async function PATCH(request: Request) {
  const pathname = new URL(request.url).pathname;

  logger.warn({
    method: 'PATCH',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
});
