import Link from 'next/link';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: string | ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        {typeof icon === 'string' ? (
          <div className="text-6xl">{icon}</div>
        ) : (
          icon
        )}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted mb-6 max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-black bg-primary hover:bg-primary-dark shadow-lg hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
