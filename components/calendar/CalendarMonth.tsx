'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { CalendarEvent } from '@/lib/calendar-events';
import {
  buildMonthGrid,
  formatMonthParam,
  getFirstDayOfWeek,
  shiftMonth,
  type MonthRef,
} from '@/lib/calendar-month';

interface CalendarMonthProps extends MonthRef {
  events: CalendarEvent[];
  /** True when the URL names no month, so the server picked it from its own clock. */
  isDefaultMonth?: boolean;
}

const chevron = (path: string) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function CalendarMonth({ year, monthIndex, events, isDefaultMonth = false }: CalendarMonthProps) {
  const router = useRouter();
  const t = useTranslations('calendar');
  const tDashboard = useTranslations('dashboard');
  const locale = useLocale();

  // The viewer's own "today" is only known in the browser, so it is filled in
  // after mount rather than rendered on the server in the server's timezone.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);

  // When the server guessed the month from its own clock and the browser is in
  // another month (different timezone near a month boundary), switch to the browser's.
  useEffect(() => {
    if (!isDefaultMonth) return;
    const now = new Date();
    if (now.getFullYear() !== year || now.getMonth() !== monthIndex) {
      router.replace(`/calendar?month=${formatMonthParam({ year: now.getFullYear(), monthIndex: now.getMonth() })}`);
    }
  }, [isDefaultMonth, year, monthIndex, router]);

  const month: MonthRef = { year, monthIndex };
  const firstDayOfWeek = getFirstDayOfWeek(locale);
  const weeks = useMemo(
    () => buildMonthGrid({ year, monthIndex }, firstDayOfWeek),
    [year, monthIndex, firstDayOfWeek]
  );

  const monthTitle = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthIndex, 1)));

  // 7 January 2024 was a Sunday, which makes it a convenient anchor for weekday names.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(2024, 0, 7 + ((firstDayOfWeek + i) % 7)));
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(date),
    };
  });

  const dayLabel = (day: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, monthIndex, day)));

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const event of events) {
    eventsByDay.set(event.day, [...(eventsByDay.get(event.day) ?? []), event]);
  }

  const isToday = (day: number) =>
    today !== null &&
    today.getFullYear() === year &&
    today.getMonth() === monthIndex &&
    today.getDate() === day;

  const eventText = (event: CalendarEvent) =>
    event.titleKey ? tDashboard(event.titleKey) : event.title;

  const eventLink = (event: CalendarEvent) => (
    <Link
      key={event.id}
      href={`/people/${event.personId}`}
      className={`block rounded-md px-2 py-1 text-left transition-colors ${
        event.type === 'contact_reminder'
          ? 'bg-surface-elevated text-muted hover:text-foreground'
          : 'bg-primary/10 text-primary hover:bg-primary/20'
      }`}
    >
      <span className="block truncate text-sm font-medium">{event.personName}</span>
      <span className="block truncate text-xs">{eventText(event)}</span>
    </Link>
  );

  const navLinkClass =
    'inline-flex items-center justify-center rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors';

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground capitalize">{monthTitle}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${formatMonthParam(shiftMonth(month, -1))}`}
            className={navLinkClass}
            aria-label={t('previousMonth')}
          >
            {chevron('M15.75 19.5L8.25 12l7.5-7.5')}
          </Link>
          <Link
            href={today ? `/calendar?month=${formatMonthParam({ year: today.getFullYear(), monthIndex: today.getMonth() })}` : '/calendar'}
            className={navLinkClass}
          >
            {t('today')}
          </Link>
          <Link
            href={`/calendar?month=${formatMonthParam(shiftMonth(month, 1))}`}
            className={navLinkClass}
            aria-label={t('nextMonth')}
          >
            {chevron('M8.25 4.5l7.5 7.5-7.5 7.5')}
          </Link>
        </div>
      </div>

      {/* Month grid on wider screens */}
      <table className="hidden sm:table w-full table-fixed border-collapse bg-surface border border-border rounded-lg">
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th
                key={weekday.long}
                scope="col"
                abbr={weekday.long}
                className="border border-border px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted"
              >
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((day, dayIndex) => (
                <td
                  key={dayIndex}
                  className={`h-28 border border-border align-top p-1.5 ${day === null ? 'bg-surface-elevated/40' : ''}`}
                >
                  {day !== null && (
                    <>
                      <div
                        className={`mb-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                          isToday(day) ? 'bg-primary text-white' : 'text-muted'
                        }`}
                        aria-current={isToday(day) ? 'date' : undefined}
                      >
                        {day}
                      </div>
                      <div className="space-y-1">{(eventsByDay.get(day) ?? []).map(eventLink)}</div>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Agenda list on narrow screens, where seven columns would be unreadable */}
      <div className="sm:hidden space-y-4">
        {[...eventsByDay.keys()]
          .sort((a, b) => a - b)
          .map((day) => (
            <section key={day}>
              <h2
                className={`mb-2 text-sm font-semibold ${isToday(day) ? 'text-primary' : 'text-muted'}`}
                aria-current={isToday(day) ? 'date' : undefined}
              >
                {dayLabel(day)}
              </h2>
              <div className="space-y-1">{(eventsByDay.get(day) ?? []).map(eventLink)}</div>
            </section>
          ))}
      </div>

      {events.length === 0 && <p className="mt-6 text-center text-sm text-muted">{t('noEvents')}</p>}
    </div>
  );
}
