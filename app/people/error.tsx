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
    console.error('People page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">👥</div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Failed to load people
        </h2>
        <p className="text-muted mb-6">
          There was a problem loading your contacts. Please try again.
        </p>
        <div className="flex justify-center space-x-3">
          <button
            onClick={reset}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
