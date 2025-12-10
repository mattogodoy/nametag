/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js to set up instrumentation
 * Used for Sentry, Redis, and other monitoring tools
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Sentry
    await import('./sentry.server.config');
    
    // Initialize Redis connection before handling requests
    const { initRedis } = await import('./lib/redis');
    try {
      await initRedis();
      console.log('✅ Redis initialized successfully');
    } catch (error) {
      console.error('❌ Redis initialization failed:', error);
      // Don't fail the app startup, just log the error
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

