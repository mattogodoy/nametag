/**
 * Next.js Instrumentation
 * This file is automatically loaded by Next.js to set up instrumentation
 * Used for Sentry and other monitoring tools
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

