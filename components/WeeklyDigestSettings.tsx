'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface WeeklyDigestSettingsProps {
  currentEnabled: boolean;
  currentWeekday: number;
  disabled: boolean;
}

// 0 = Sunday ... 6 = Saturday, matching Date.prototype.getDay().
const WEEKDAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6] as const;

export default function WeeklyDigestSettings({ currentEnabled, currentWeekday, disabled }: WeeklyDigestSettingsProps) {
  const t = useTranslations('settings.notifications');
  const router = useRouter();
  const [enabled, setEnabled] = useState(currentEnabled);
  const [weekday, setWeekday] = useState(currentWeekday);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const save = async (nextEnabled: boolean, nextWeekday: number) => {
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/user/weekly-digest', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: nextEnabled, weekday: nextWeekday }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || t('digestError'));
        setIsSuccess(false);
        return;
      }

      setEnabled(nextEnabled);
      setWeekday(nextWeekday);
      setMessage(t('digestSuccess'));
      setIsSuccess(true);
      router.refresh();

      // Clear success message after 2 seconds
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('digestError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (disabled || isLoading) return;
    save(!enabled, weekday);
  };

  const handleWeekdayChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newWeekday = Number(event.target.value);
    save(enabled, newWeekday);
  };

  return (
    <div className="space-y-4">
      <label
        className={`flex items-center justify-between gap-4 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="text-foreground">{t('digestToggle')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={disabled || isLoading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>

      {enabled && (
        <div>
          <label htmlFor="weekly-digest-weekday" className="block text-sm font-medium text-muted mb-2">
            {t('digestDay')}
          </label>
          <select
            id="weekly-digest-weekday"
            value={weekday}
            onChange={handleWeekdayChange}
            disabled={disabled || isLoading}
            className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {WEEKDAY_OPTIONS.map((day) => (
              <option key={day} value={day}>
                {t(`weekdays.${day}`)}
              </option>
            ))}
          </select>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
