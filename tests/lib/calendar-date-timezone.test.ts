import { describe, it, expect, afterEach } from 'vitest';
import {
  formatDate,
  formatDateWithoutYear,
  parseAsLocalDate,
  parseCalendarDate,
} from '@/lib/date-format';
import { getNextOccurrence } from '@/lib/upcoming-events';

/**
 * Regression tests for calendar dates read straight from the database.
 *
 * Nametag stores calendar dates as UTC midnight, but `parseAsLocalDate` only
 * anchors the calendar day when it is handed a string. `Date` values pass
 * through untouched, and the formatters then read them with `getDate()`, which
 * reports the previous day anywhere west of UTC.
 *
 * Year-unknown dates make this much wider than it looks. They use 1604, which
 * predates standard time zones, so JavaScript falls back to Local Mean Time and
 * almost every zone sits west of UTC: Madrid is -0:14:44 and London is -0:01:15
 * in 1604, even though both are east of UTC today. A birthday saved as
 * "August 10" with no year rendered as "August 9" for nearly everyone, while
 * the edit form (a client component, where the same value arrives as a string)
 * kept showing the correct day.
 *
 * These tests pin the process timezone because the bug is invisible under UTC.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

function withTimezone<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  return fn();
}

// Madrid and London are east of UTC today but west of it in 1604, which is the
// combination that made only year-unknown dates look broken. New York is west
// in both eras, Sydney east in both.
const TIMEZONES = [
  'UTC',
  'Europe/Madrid',
  'Europe/London',
  'America/New_York',
  'Australia/Sydney',
];

/** A calendar date as Prisma hands it back: UTC midnight on the stored day. */
function storedCalendarDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe('calendar dates read from the database', () => {
  describe('parseCalendarDate', () => {
    it.each(TIMEZONES)('keeps a year-unknown date on its own day in %s', (tz) => {
      withTimezone(tz, () => {
        const parsed = parseCalendarDate(storedCalendarDate('1604-08-10'));
        expect(parsed.getFullYear()).toBe(1604);
        expect(parsed.getMonth()).toBe(7);
        expect(parsed.getDate()).toBe(10);
      });
    });

    it.each(TIMEZONES)('keeps a known-year date on its own day in %s', (tz) => {
      withTimezone(tz, () => {
        const parsed = parseCalendarDate(storedCalendarDate('1990-05-15'));
        expect(parsed.getFullYear()).toBe(1990);
        expect(parsed.getMonth()).toBe(4);
        expect(parsed.getDate()).toBe(15);
      });
    });

    it.each(TIMEZONES)('agrees with the string form it replaces in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1604-08-10');
        expect(parseCalendarDate(stored).getTime()).toBe(
          parseAsLocalDate(stored.toISOString()).getTime(),
        );
      });
    });

    it.each(TIMEZONES)('still anchors strings in %s', (tz) => {
      withTimezone(tz, () => {
        const parsed = parseCalendarDate('1604-08-10');
        expect(parsed.getMonth()).toBe(7);
        expect(parsed.getDate()).toBe(10);
      });
    });
  });

  describe('rendering, as the person detail page does it', () => {
    it.each(TIMEZONES)('renders a year-unknown birthday as August 10 in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1604-08-10');
        expect(formatDateWithoutYear(parseCalendarDate(stored), 'MDY')).toBe('August 10');
        expect(formatDateWithoutYear(parseCalendarDate(stored), 'DMY')).toBe('10 August');
      });
    });

    it.each(TIMEZONES)('renders a known-year birthday on its own day in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1990-05-15');
        expect(formatDate(parseCalendarDate(stored), 'YMD')).toBe('1990-05-15');
      });
    });

    it.each(TIMEZONES)('reports the year-unknown sentinel as 1604 in %s', (tz) => {
      withTimezone(tz, () => {
        // The person page decides which formatter to use from getFullYear().
        expect(parseCalendarDate(storedCalendarDate('1604-08-10')).getFullYear()).toBe(1604);
      });
    });
  });

  describe('next occurrence, as the dashboard and reminders do it', () => {
    it.each(TIMEZONES)('projects a year-unknown birthday onto August 10 in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1604-08-10');
        const today = new Date(2026, 7, 1);
        const next = getNextOccurrence(parseCalendarDate(stored), today, 1, 'YEARS', null);

        expect(next.getFullYear()).toBe(2026);
        expect(next.getMonth()).toBe(7);
        expect(next.getDate()).toBe(10);
      });
    });

    it.each(TIMEZONES)('rolls to next year once the day has passed in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1604-08-10');
        const today = new Date(2026, 7, 11);
        const next = getNextOccurrence(parseCalendarDate(stored), today, 1, 'YEARS', null);

        expect(next.getFullYear()).toBe(2027);
        expect(next.getMonth()).toBe(7);
        expect(next.getDate()).toBe(10);
      });
    });

    it.each(TIMEZONES)('treats the birthday itself as due today in %s', (tz) => {
      withTimezone(tz, () => {
        const stored = storedCalendarDate('1604-08-10');
        const today = new Date(2026, 7, 10);
        const next = getNextOccurrence(parseCalendarDate(stored), today, 1, 'YEARS', null);

        // A reminder that fires a day early is the same bug wearing a hat.
        expect(next.getFullYear()).toBe(2026);
        expect(next.getDate()).toBe(10);
      });
    });
  });
});
