'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getLeadTimeLabel, getLeadTimeSelectOptions } from '@/lib/reminders/lead-time-options';

interface ReminderLeadTimeSelectorProps {
  currentLeadDays: number;
  disabled: boolean;
}

export default function ReminderLeadTimeSelector({ currentLeadDays, disabled }: ReminderLeadTimeSelectorProps) {
  const t = useTranslations('settings.notifications');
  const router = useRouter();
  const [leadDays, setLeadDays] = useState(currentLeadDays);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // The API accepts any value from 0 to 365, not just the presets below. If
  // the current value is a non-preset (set via the API, for example), it is
  // appended here so the select shows the truth instead of rendering blank.
  const selectOptions = getLeadTimeSelectOptions(leadDays);

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const previousValue = leadDays;
    const newValue = Number(event.target.value);

    // Optimistic: this select is a controlled input, so the DOM value
    // follows this state on the very next render. Setting it only after the
    // fetch resolves would make the select, and the consequence line below
    // it, visibly snap back to the old value for the whole round trip.
    setLeadDays(newValue);
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
        setLeadDays(previousValue);
        setMessage(data.error || t('leadTimeError'));
        setIsSuccess(false);
        return;
      }

      setMessage(t('leadTimeSuccess'));
      setIsSuccess(true);
      router.refresh();

      // Clear success message after 2 seconds
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setLeadDays(previousValue);
      setMessage(t('leadTimeError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {/*
        The section heading above this component (leadTimeTitle) already
        names this control visually, so a second visible label here would
        just repeat it. The label stays for assistive technology, which
        does not see the surrounding h2 as part of this control's name.
      */}
      <label htmlFor="reminder-lead-days" className="sr-only">
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
        {selectOptions.map((days) => (
          <option key={days} value={days}>
            {getLeadTimeLabel(days, t)}
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
