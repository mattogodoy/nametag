'use client';

interface UsageMeterProps {
  label: string;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

// Use fixed locale to prevent hydration mismatch between server and client
const formatNumber = (num: number) => num.toLocaleString('en-US');

export default function UsageMeter({ label, current, limit, isUnlimited }: UsageMeterProps) {
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && current >= limit;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className={`font-medium ${isAtLimit ? 'text-red-600 dark:text-red-400' : isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>
          {formatNumber(current)} / {isUnlimited ? 'Unlimited' : formatNumber(limit)}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-surface-elevated rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isAtLimit
                ? 'bg-red-600'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {isUnlimited && (
        <div className="w-full bg-green-100 dark:bg-green-900/30 rounded-full h-2">
          <div className="h-2 rounded-full bg-green-600 w-full" />
        </div>
      )}
    </div>
  );
}
