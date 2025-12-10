import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

/**
 * Development-only endpoint to clear rate limits
 * 
 * Usage:
 *   DELETE /api/dev/clear-rate-limits?type=register
 *   DELETE /api/dev/clear-rate-limits?all=true
 */
export async function DELETE(request: Request) {
  // Only allow in development/test or with CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const isAuthorized = 
    process.env.NODE_ENV !== 'production' ||
    (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
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

    return NextResponse.json({
      message: 'Rate limits cleared successfully',
      pattern,
      count: keys.length,
      keys: keys.slice(0, 10), // Show first 10 keys
    });
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    return NextResponse.json(
      { error: 'Failed to clear rate limits', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

