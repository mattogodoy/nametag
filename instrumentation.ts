/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js to set up instrumentation
 */

import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('init');

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize Redis connection before handling requests
    const { initRedis } = await import('./lib/redis');
    try {
      await initRedis();
      log.info('Redis initialized successfully');
    } catch (error) {
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Redis initialization failed');
      // Don't fail the app startup, just log the error
    }
  }
}
