import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('health');

/**
 * Health check endpoint for monitoring and orchestration
 * GET /api/health
 *
 * Returns:
 * - 200: Service is healthy
 * - 503: Service is unhealthy (e.g., database connection failed)
 *
 * This endpoint is unauthenticated so that container orchestrators and uptime
 * monitors can reach it, which means the response body must stay free of
 * internal detail. Prisma connection errors quote the host, port, and
 * sometimes the database user, so the error goes to the log and the caller
 * only learns that the check failed.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: {
          status: 'connected',
          latency: `${dbLatency}ms`,
        },
      },
    });
  } catch (error) {
    const dbLatency = Date.now() - startTime;

    log.error(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Health check failed: database unreachable'
    );

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'disconnected',
            latency: `${dbLatency}ms`,
          },
        },
      },
      { status: 503 }
    );
  }
}
