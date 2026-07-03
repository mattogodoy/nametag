'use client';

import { useTranslations } from 'next-intl';
import type { FormData } from '../../hooks/usePersonForm';

interface CardDavSyncSectionProps {
  mode: 'create' | 'edit';
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  hasCardDavMapping: boolean;
}

export default function CardDavSyncSection({
  mode,
  formData,
  onFormDataChange,
  hasCardDavMapping,
}: CardDavSyncSectionProps) {
  const t = useTranslations('people.form');

  return (
    <div className="p-3 bg-surface-elevated rounded-lg">
      <div className="flex items-center gap-2">
        <button
          type="button"
          id="carddav-sync-toggle"
          onClick={() =>
            onFormDataChange({ cardDavSyncEnabled: !formData.cardDavSyncEnabled })
          }
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            formData.cardDavSyncEnabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
              formData.cardDavSyncEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <label
          htmlFor="carddav-sync-toggle"
          className="flex items-center gap-1.5 text-sm text-muted"
        >
          {t('cardDavSyncLabel')}
          <div className="group relative inline-block">
            <svg
              className="w-4 h-4 text-muted cursor-help"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-surface-elevated text-foreground text-xs rounded-lg whitespace-normal w-64 z-10 pointer-events-none">
              {t('cardDavSyncTooltip')}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-surface-elevated"></div>
            </div>
          </div>
        </label>
      </div>
      {!formData.cardDavSyncEnabled && mode === 'edit' && hasCardDavMapping && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
          {t('cardDavSyncDisableWarning')}
        </p>
      )}
    </div>
  );
}
