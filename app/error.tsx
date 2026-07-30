'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import OfflineNotice from '@/components/OfflineNotice';
import { useIsOffline } from '@/hooks/useIsOffline';

/*
 * Rendering OfflineNotice from every error boundary has a side benefit beyond
 * the calmer copy: its client chunk used to be referenced only by the /offline
 * route, which almost nobody visits while online, so it was never cached and
 * could not hydrate during an offline navigation. Reusing it here puts it in
 * routes people actually browse, so the service worker warms its cache during
 * normal use.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isOffline = useIsOffline();

  useEffect(() => {
    // Log the error
    console.error('Page error:', error);
    
    // Send to server logger
    fetch('/api/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      }),
    }).catch(() => {
      // Ignore if logging fails
    });
  }, [error]);

  // A failed request while the device is offline is not a crash. Show the calm
  // offline page rather than an alarming "something went wrong".
  if (isOffline) {
    return <OfflineNotice />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-red-600">Error</h1>
          <h2 className="text-2xl font-semibold text-muted">
            Something went wrong!
          </h2>
          <p className="text-muted">
            An unexpected error occurred. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 text-left text-xs bg-surface-elevated text-foreground p-4 rounded overflow-auto max-h-60">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={reset}
            className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex justify-center items-center px-6 py-3 border border-border text-base font-medium rounded-lg text-muted bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
