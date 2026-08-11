import { afterEach } from 'vitest';
import { YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';

/**
 * Timezones that exercise the calendar-date storage convention from every
 * angle. Madrid and London are east of UTC today but west of it in 1604
 * (Local Mean Time applies under the year-unknown sentinel), which is the
 * combination that made only year-unknown dates look broken. New York is west
 * in both eras, Sydney east in both. The bug class is invisible under UTC.
 */
export const TIMEZONES = [
  'UTC',
  'Europe/Madrid',
  'Europe/London',
  'America/New_York',
  'Australia/Sydney',
];

const ORIGINAL_TZ = process.env.TZ;

export function setProcessTimezone(tz: string): void {
  process.env.TZ = tz;
}

export function restoreProcessTimezone(): void {
  // Assigning `undefined` to process.env.TZ would coerce it to the string
  // "undefined", which Node treats as a fallback UTC zone: exactly the one
  // timezone where calendar-date bugs are invisible. Delete instead.
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
}

/** Restore the process timezone after each test in the enclosing suite. */
export function restoreTimezoneAfterEach(): void {
  afterEach(restoreProcessTimezone);
}

/** Run `fn` under a pinned process timezone, restoring afterwards. */
export function withTimezone<T>(tz: string, fn: () => T): T {
  setProcessTimezone(tz);
  try {
    return fn();
  } finally {
    restoreProcessTimezone();
  }
}

/**
 * A calendar date as Prisma hands it back: UTC midnight on the stored day.
 * Accepts `YYYY-MM-DD` or a local Date whose calendar day should be encoded.
 */
export function storedCalendarDate(day: Date | string): Date {
  if (typeof day === 'string') {
    return new Date(`${day}T00:00:00.000Z`);
  }
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
}

/** The stored form of a year-unknown date on the same month and day as `day`. */
export function storedYearUnknownDate(day: Date): Date {
  return new Date(Date.UTC(YEAR_UNKNOWN_SENTINEL, day.getMonth(), day.getDate()));
}
