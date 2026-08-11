'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface ReminderLeadTimeSelectorProps {
  currentLeadDays: number;
  disabled: boolean;
}

const LEAD_DAY_OPTIONS = [0, 1, 3, 7, 14, 30] as const;

export default function ReminderLeadTimeSelector({ currentLeadDays, disabled }: ReminderLeadTimeSelectorProps) {
  const t = useTranslations('settings.notifications');
  const router = useRouter();
  const [leadDays, setLeadDays] = useState(currentLeadDays);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const getOptionLabel = (days: number) => {
    if (days === 0) return t('leadTimeDayOf');
    if (days === 1) return t('leadTimeOneDay');
    return t('leadTimeDays', { days });
  };

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = Number(event.target.value);
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/user/reminder-lead-days', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: newValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || t('leadTimeError'));
        setIsSuccess(false);
        return;
      }

      setLeadDays(newValue);
      setMessage(t('leadTimeSuccess'));
      setIsSuccess(true);
      router.refresh();

      // Clear success message after 2 seconds
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('leadTimeError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <label htmlFor="reminder-lead-days" className="block text-sm font-medium text-muted mb-2">
        {t('leadTimeTitle')}
      </label>
      <select
        id="reminder-lead-days"
        value={leadDays}
        onChange={handleChange}
        disabled={disabled || isLoading}
        aria-describedby="reminder-lead-days-summary"
        className="w-full max-w-xs px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {LEAD_DAY_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {getOptionLabel(days)}
          </option>
        ))}
      </select>

      {/*
        The whole point of this control: someone changing the lead time must
        never have to guess whether the day-of reminder still fires. It always
        does, so the summary line always says so.
      */}
      <p id="reminder-lead-days-summary" className="mt-3 text-sm text-muted">
        {leadDays === 0 ? t('leadTimeSummaryDayOf') : t('leadTimeSummary', { days: leadDays })}
      </p>

      {message && (
        <p
          className={`mt-2 text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
