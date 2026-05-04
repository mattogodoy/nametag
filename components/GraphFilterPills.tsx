'use client';

import { useTranslations } from 'next-intl';

interface GraphFilterGroupPillProps {
  id: string;
  label: string;
  color: string | null;
  isNegative: boolean;
  title?: string;
  ariaLabel?: string;
  onToggle?: () => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
}

export function GraphFilterGroupPill({
  id,
  label,
  color,
  isNegative,
  title,
  ariaLabel,
  onToggle,
  onRemove,
  removeDisabled,
}: GraphFilterGroupPillProps) {
  const tDashboard = useTranslations('dashboard');
  const isInteractive = Boolean(onToggle);
  const showRemoveButton = Boolean(onRemove) || removeDisabled;

  return (
    <div
      key={id}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (!onToggle) {
          return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex h-8 items-center gap-1.5 px-3 border rounded-full text-sm font-medium shadow-sm select-none transition-colors ${
        isInteractive ? 'cursor-pointer' : ''
      } ${
        isNegative
          ? 'bg-red-100 border-red-300 hover:bg-red-200 dark:bg-red-900/30 dark:border-red-700/50 dark:hover:bg-red-900/45'
          : 'bg-green-100 border-green-300 hover:bg-green-200 dark:bg-green-900/30 dark:border-green-700/50 dark:hover:bg-green-900/45'
      }`}
    >
      <div
        className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/50"
        style={{ backgroundColor: color || '#7bf080' }}
      />
      <span className="text-foreground">{label}</span>

      {showRemoveButton && (
        <button
          type="button"
          disabled={removeDisabled}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={`rounded-full p-0.5 transition-colors ${
            removeDisabled
              ? 'cursor-not-allowed opacity-60'
              : 'hover:bg-foreground/10'
          }`}
            aria-label={tDashboard('graph.filterAction.removeWithLabel', {
              label,
            })}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
