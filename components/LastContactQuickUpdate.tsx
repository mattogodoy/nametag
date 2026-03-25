'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { formatDate, type DateFormat } from '@/lib/date-format';

function getRelativeTime(
  date: Date,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('today');
  if (diffDays === 1) return t('oneDayAgo');
  if (diffDays < 28) return t('daysAgo', { days: diffDays });

  // Use calendar-based month/year diff for accuracy
  let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months--;

  if (months < 12) {
    if (months <= 0) return t('daysAgo', { days: diffDays });
    return months === 1 ? t('oneMonthAgo') : t('monthsAgo', { months });
  }
  const years = Math.floor(months / 12);
  return years === 1 ? t('oneYearAgo') : t('yearsAgo', { years });
}

interface LastContactQuickUpdateProps {
  personId: string;
  currentLastContact: string | null;
  dateFormat: DateFormat;
  contactReminderDescription?: string | null;
}

export default function LastContactQuickUpdate({
  personId,
  currentLastContact,
  dateFormat,
  contactReminderDescription,
}: LastContactQuickUpdateProps) {
  const t = useTranslations('people');
  const router = useRouter();
  const [lastContact, setLastContact] = useState(currentLastContact);
  const [isLoading, setIsLoading] = useState(false);

  async function handleContactedToday() {
    const today = new Date().toISOString().split('T')[0];
    const previousValue = lastContact;

    // Optimistic update
    setLastContact(new Date().toISOString());
    setIsLoading(true);

    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastContact: today }),
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      toast.success(t('lastContactUpdated'));
      router.refresh();
    } catch {
      // Revert optimistic update
      setLastContact(previousValue);
      toast.error(t('lastContactUpdateError'));
    } finally {
      setIsLoading(false);
    }
  }

  const parsedDate = lastContact ? new Date(lastContact) : null;
  const isToday = !isLoading && parsedDate && Math.floor(Math.abs(new Date().getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24)) === 0;

  return (
    <div>
      <h4 className="text-sm font-medium text-muted mb-1">
        {t('lastTimeTalked')}
      </h4>
      <div className="flex items-center gap-2">
        <p className="text-foreground">
          {parsedDate ? (
            <>
              {formatDate(parsedDate, dateFormat)}{' '}
              <span className="text-sm text-muted">
                ({getRelativeTime(parsedDate, t)})
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">{t('noContactRecorded')}</span>
          )}
        </p>
        {!isToday && <button
          type="button"
          title={t('updateToToday')}
          onClick={handleContactedToday}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 2v4M8 2v4M3 10h18" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 16l2 2 4-4" />
            </svg>
          )}
          {t('updateToToday')}
        </button>}
      </div>
      {contactReminderDescription && (
        <div className="text-xs text-primary mt-1 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {contactReminderDescription}
        </div>
      )}
    </div>
  );
}
