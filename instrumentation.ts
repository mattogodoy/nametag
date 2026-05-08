/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js to set up instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createModuleLogger } = await import('./lib/logger');
    const log = createModuleLogger('init');

    const { initRedis } = await import('./lib/redis');
    try {
      await initRedis();
      log.info('Redis initialized successfully');
    } catch (error) {
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Redis initialization failed');
    }
  }
}
