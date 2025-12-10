import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Client-side error logging endpoint
 * Allows the browser to send errors to the server for logging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, stack, digest, url, userAgent } = body;

    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';

    logger.error('Client-side error', {
      message,
      stack,
      digest,
      url,
      userAgent: userAgent || request.headers.get('user-agent'),
      ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // If error logging fails, still return success to avoid infinite loops
    console.error('Failed to log client error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

