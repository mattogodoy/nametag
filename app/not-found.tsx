import Link from 'next/link';

export default function NotFound() {
  // Note: This component is also rendered during static generation
  // Logging happens in middleware/proxy for actual runtime 404s

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-foreground">404</h1>
          <h2 className="text-2xl font-semibold text-muted">
            Page Not Found
          </h2>
          <p className="text-muted">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-black bg-primary hover:bg-primary-dark shadow-lg hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="inline-flex justify-center items-center px-6 py-3 border border-border text-base font-medium rounded-lg text-muted bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

