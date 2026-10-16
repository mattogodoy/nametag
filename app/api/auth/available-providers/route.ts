import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/api-utils';
import { getLoginProviders } from '@/lib/server-info';

export const GET = withLogging(async function GET() {
  return NextResponse.json({ providers: getLoginProviders() });
});
