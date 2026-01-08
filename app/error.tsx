'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-primary hover:bg-primary-dark shadow-lg hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex justify-center items-center px-6 py-3 border border-border text-base font-medium rounded-lg text-muted bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
