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
    console.error('Relationship types error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-4">
          <span className="icon-[tabler--link-off] size-16 text-error" />
        </div>
        <h2 className="text-2xl font-bold mb-2">
          Failed to load relationship types
        </h2>
        <p className="text-base-content/70 mb-6">
          There was a problem loading your relationship types. Please try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="btn btn-primary"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="btn btn-ghost"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
