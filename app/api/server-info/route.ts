import { NextResponse } from 'next/server';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { getServerInfo } from '@/lib/server-info';

/**
 * Public description of this server for native clients: version, API
 * version, mode, login methods and optional features. Unauthenticated
 * because clients call it before sign-in to decide what to show.
 */
export const GET = withLogging(async function GET() {
  try {
    const info = await getServerInfo();
    return NextResponse.json(info, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    return handleApiError(error, 'server-info');
  }
});
