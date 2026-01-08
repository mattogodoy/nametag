import Link from 'next/link';

interface LimitReachedMessageProps {
  resourceType: 'people' | 'groups' | 'reminders';
  current: number;
  limit: number;
  tier: string;
}

const resourceLabels = {
  people: { singular: 'person', plural: 'people' },
  groups: { singular: 'group', plural: 'groups' },
  reminders: { singular: 'reminder', plural: 'reminders' },
};

export default function LimitReachedMessage({
  resourceType,
  limit,
  tier,
}: LimitReachedMessageProps) {
  const labels = resourceLabels[resourceType];

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <div className="text-center py-8">
        <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {labels.singular.charAt(0).toUpperCase() + labels.singular.slice(1)} Limit Reached
        </h2>
        <p className="text-muted mb-4">
          You&apos;ve reached the maximum of {limit} {labels.plural} on the{' '}
          <span className="font-medium">{tier}</span> plan.
        </p>
        <p className="text-muted mb-6">
          Upgrade your plan to add more {labels.plural} to your network.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/settings/billing"
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors"
          >
            Upgrade Plan
          </Link>
          <Link
            href={`/${resourceType === 'people' ? 'people' : resourceType}`}
            className="px-6 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
          >
            Go Back
          </Link>
        </div>
      </div>
    </div>
  );
}
