import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/api-utils';
import { getAvailableAuthProviders } from '@/lib/auth-providers';

/**
 * Returns available authentication providers
 * Used by client-side components to show/hide OAuth buttons
 */
export const GET = withLogging(async function GET() {
  return NextResponse.json(getAvailableAuthProviders());
});
