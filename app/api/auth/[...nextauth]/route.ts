import { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { withLogging } from '@/lib/api-utils';

export const runtime = 'nodejs';

export const GET = withLogging(handlers.GET);

// Wrap POST handler to add rate limiting for login attempts
export const POST = withLogging(async function POST(request: NextRequest) {
  // Check rate limit for login attempts
  const rateLimitResponse = checkRateLimit(request, 'login');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Call the original NextAuth handler
  return handlers.POST(request);
});
