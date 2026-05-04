'use client';

import { useTranslations } from 'next-intl';
import DatePicker from '../ui/DatePicker';
import { getLocalDateString } from '@/lib/date-format';
import type { FormData } from '../../hooks/usePersonForm';

type ReminderIntervalUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

interface ReminderLimit {
  canCreate: boolean;
  current: number;
  limit: number;
  isUnlimited: boolean;
}

interface LastContactSectionProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  dateFormat?: 'MDY' | 'DMY' | 'YMD';
  reminderLimit?: ReminderLimit;
}

export default function LastContactSection({
  formData,
  onFormDataChange,
  dateFormat = 'MDY',
  reminderLimit,
}: LastContactSectionProps) {
  const t = useTranslations('people.form');

  const canToggleContactReminder =
    formData.contactReminderEnabled ||
    !reminderLimit ||
    reminderLimit.isUnlimited ||
    reminderLimit.canCreate;

  return (
    <div className="space-y-3">
      <DatePicker
        value={formData.lastContact}
        onChange={(val) => onFormDataChange({ lastContact: val })}
        dateFormat={dateFormat}
        showTodayButton
        maxDate={getLocalDateString()}
      />
      {formData.lastContact && (
        <button
          type="button"
          onClick={() => onFormDataChange({ lastContact: '' })}
          className="text-sm text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          {t('clearLastContact')}
        </button>
      )}

      <div className="p-3 bg-surface-elevated rounded-lg">
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            id="contact-reminder-toggle"
            disabled={!canToggleContactReminder}
            onClick={() => {
              if (!canToggleContactReminder) return;
              onFormDataChange({
                contactReminderEnabled: !formData.contactReminderEnabled,
              });
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              formData.contactReminderEnabled ? 'bg-primary' : 'bg-muted'
            } ${!canToggleContactReminder ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                formData.contactReminderEnabled
                  ? 'translate-x-6'
                  : 'translate-x-1'
              }`}
            />
          </button>
          <label
            htmlFor="contact-reminder-toggle"
            className="text-sm text-muted"
          >
            {t('remindMeToCatchUp')}
          </label>
          <input
            type="number"
            min="1"
            max="99"
            disabled={!formData.contactReminderEnabled}
            value={formData.contactReminderInterval}
            onChange={(e) =>
              onFormDataChange({
                contactReminderInterval: Math.max(
                  1,
                  parseInt(e.target.value) || 1
                ),
              })
            }
            className="w-16 px-2 py-1 text-base sm:text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <select
            disabled={!formData.contactReminderEnabled}
            value={formData.contactReminderIntervalUnit}
            onChange={(e) =>
              onFormDataChange({
                contactReminderIntervalUnit: e.target
                  .value as ReminderIntervalUnit,
              })
            }
            className="px-2 py-1 text-base sm:text-sm border border-border rounded bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="DAYS">{t('days')}</option>
            <option value="WEEKS">{t('weeks')}</option>
            <option value="MONTHS">{t('months')}</option>
            <option value="YEARS">{t('years')}</option>
          </select>
        </div>
        {!canToggleContactReminder &&
          reminderLimit &&
          !reminderLimit.isUnlimited && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              {t('reminderLimitReached', { limit: reminderLimit.limit })}
            </p>
          )}
      </div>
    </div>
  );
}
