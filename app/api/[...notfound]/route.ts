import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Catch-all route handler for unmatched API routes
 * This helps us log 404s for API endpoints
 */
export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  logger.warn({
    method: 'GET',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
}

export async function POST(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  logger.warn({
    method: 'POST',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
}

export async function PUT(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  logger.warn({
    method: 'PUT',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
}

export async function DELETE(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  logger.warn({
    method: 'DELETE',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
}

export async function PATCH(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  logger.warn({
    method: 'PATCH',
    path: pathname,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
  }, 'API endpoint not found');

  return NextResponse.json(
    { error: 'Not Found', path: pathname },
    { status: 404 }
  );
}

