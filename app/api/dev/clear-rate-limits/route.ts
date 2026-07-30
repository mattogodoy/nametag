import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { logger, securityLogger } from '@/lib/logger';
import { getClientIp, withLogging } from '@/lib/api-utils';
import { hasValidBearerSecret } from '@/lib/shared-secret';

/**
 * Maintenance endpoint to clear rate limits, used during development and when
 * an operator needs to unblock a locked-out account.
 *
 * Requires `Authorization: Bearer $CRON_SECRET` in every environment. The
 * previous guard also accepted any request when `NODE_ENV !== 'production'`,
 * which fails open: the standalone server is started with `node server.js`,
 * which does not set NODE_ENV, so a self-hosted deployment that did not set it
 * explicitly exposed unauthenticated rate-limit clearing.
 *
 * Usage:
 *   DELETE /api/dev/clear-rate-limits?type=register
 *   DELETE /api/dev/clear-rate-limits?all=true
 */
export const DELETE = withLogging(async function DELETE(request: Request) {
  if (!hasValidBearerSecret(request, process.env.CRON_SECRET)) {
    securityLogger.authFailure(getClientIp(request), 'Invalid cron secret', {
      endpoint: 'clear-rate-limits',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: 'Redis not available' },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const all = searchParams.get('all') === 'true';

    let pattern: string;
    if (all) {
      pattern = 'ratelimit:*';
    } else if (type) {
      pattern = `ratelimit:${type}:*`;
    } else {
      return NextResponse.json(
        { error: 'Must specify type parameter or all=true' },
        { status: 400 }
      );
    }

    // Get all keys matching pattern
    const keys = await redis.keys(pattern);

    if (keys.length === 0) {
      return NextResponse.json({
        message: 'No rate limits found',
        pattern,
        count: 0,
      });
    }

    // Delete all matching keys
    await redis.del(...keys);

    // The keys themselves are deliberately not returned: a rate-limit key
    // embeds the client IP and, for login and password reset, the email
    // address that was attempted.
    return NextResponse.json({
      message: 'Rate limits cleared successfully',
      pattern,
      count: keys.length,
    });
  } catch (error) {
    logger.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error clearing rate limits');
    return NextResponse.json(
      { error: 'Failed to clear rate limits' },
      { status: 500 }
    );
  }
});
