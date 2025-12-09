import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Health check endpoint for monitoring and orchestration
 * GET /api/health
 * 
 * Returns:
 * - 200: Service is healthy
 * - 503: Service is unhealthy (e.g., database connection failed)
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
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'disconnected',
            latency: `${dbLatency}ms`,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 503 }
    );
  }
}

