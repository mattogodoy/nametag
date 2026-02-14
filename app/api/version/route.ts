import { NextResponse } from 'next/server';
import { getVersion } from '@/lib/version';

/**
 * Version endpoint for monitoring tools (e.g. release-argus.io)
 * GET /api/version
 *
 * Returns the current installed version of the application.
 */
export function GET() {
  return NextResponse.json({ version: getVersion() });
}
