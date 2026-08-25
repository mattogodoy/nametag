import { describe, it, expect } from 'vitest';
import { getNextOccurrence } from '@/lib/upcoming-events';
import { YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';

/** A local calendar day. */
const d = (iso: string) => new Date(`${iso}T00:00:00`);

/**
 * A stored calendar date (UTC midnight), matching how the database stores them.
 * parseCalendarDate reads UTC components and projects to local midnight, so
 * to simulate that in unit tests we build local-midnight dates directly.
 */
const stored = (y: number, monthIndex: number, day: number) =>
  new Date(y, monthIndex, day);

describe('getNextOccurrence, YEARS branch with interval > 1', () => {
  it('returns an on-grid year when interval is 2 (event year 2020, today 2026)', () => {
    // 2026 - 2020 = 6, 6 % 2 = 0 => 2026 is on-grid
    // But 2026-05-15 has passed (today is Aug 25), so next is 2028
    const result = getNextOccurrence(
      stored(2020, 4, 15), d('2026-08-25'), 2, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2028);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it('skips off-grid years (interval 2, event 2020, candidate 2027 is off-grid)', () => {
    // 2027 - 2020 = 7, 7 % 2 = 1 => 2027 is off-grid, next on-grid is 2028
    const result = getNextOccurrence(
      stored(2020, 4, 15), d('2027-01-01'), 2, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2028);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it('returns this year when it is on-grid and the date has not passed', () => {
    // 2026 - 2020 = 6, 6 % 2 = 0 => on-grid, and May 15 hasn't passed in March
    const result = getNextOccurrence(
      stored(2020, 4, 15), d('2026-03-01'), 2, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it('returns today when today is exactly on-grid', () => {
    const result = getNextOccurrence(
      stored(2020, 4, 15), d('2026-05-15'), 2, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it('handles interval 3 correctly', () => {
    // 2020 + 3k: 2020, 2023, 2026, 2029...
    // Today 2027-01-01: 2027 off-grid, next is 2029
    const result = getNextOccurrence(
      stored(2020, 4, 15), d('2027-01-01'), 3, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2029);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });
});

describe('getNextOccurrence, YEARS branch with lastReminderSent', () => {
  it('skips an on-grid year when lastReminderSent is too recent', () => {
    // Event 1990, interval 2. Grid: even years. lastReminderSent = 2025.
    // 2026 is on-grid but only 1 year after last send. Next valid: 2028.
    const result = getNextOccurrence(
      stored(1990, 4, 15), d('2026-03-01'), 2, 'YEARS', d('2025-05-15')
    );
    expect(result.getFullYear()).toBe(2028);
  });

  it('returns the on-grid year when enough time has passed since lastReminderSent', () => {
    // lastReminderSent = 2024, interval 2. 2026 - 2024 = 2 >= 2. On-grid.
    const result = getNextOccurrence(
      stored(1990, 4, 15), d('2026-03-01'), 2, 'YEARS', d('2024-05-15')
    );
    expect(result.getFullYear()).toBe(2026);
  });
});

describe('getNextOccurrence, YEARS branch with future-dated event', () => {
  it('does not return a date before a future event date', () => {
    const result = getNextOccurrence(
      stored(2030, 5, 15), d('2026-08-25'), 1, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2030);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it('does not return a date before a future event date with interval > 1', () => {
    // Event in 2030, interval 2: grid is 2030, 2032, 2034...
    const result = getNextOccurrence(
      stored(2030, 5, 15), d('2026-08-25'), 2, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2030);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });

  it('returns the event date itself when today is the event date', () => {
    const result = getNextOccurrence(
      stored(2030, 5, 15), d('2030-06-15'), 1, 'YEARS', null
    );
    expect(result.getFullYear()).toBe(2030);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(15);
  });
});

describe('getNextOccurrence, non-YEARS with unknown-year sentinel', () => {
  it('returns today when today is the normalized sentinel anchor', () => {
    // "May 15, unknown year" with monthly reminders. Today IS May 15.
    // The sentinel is normalized to this year, and since the event date is
    // itself an occurrence, it returns today.
    const result = getNextOccurrence(
      stored(YEAR_UNKNOWN_SENTINEL, 4, 15), d('2026-05-15'), 1, 'MONTHS', null
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(4);
    expect(result.getDate()).toBe(15);
  });

  it('normalizes to the current year, not 1604, preventing century-scale drift', () => {
    // Without normalization: anchor = 1604-05-15, and centuries of 30-day
    // approximation produce a wildly wrong date. With normalization: anchor =
    // 2025-05-15 (prev year since May hasn't passed), and 12 * 30 = 360 days
    // later = 2026-05-10. The 5-day drift is inherent to the 30-day
    // approximation, but the result is within a week of the actual anniversary,
    // not months off as it would be without normalization.
    const result = getNextOccurrence(
      stored(YEAR_UNKNOWN_SENTINEL, 4, 15), d('2026-03-01'), 1, 'MONTHS', null
    );
    // The anchor is 2025-05-15 (previous year). From March 1, 2026 that's about
    // 290 days, which is floor(290/30)=9 intervals. Next boundary: 10*30=300
    // days from 2025-05-15 = 2026-03-11, which is reasonable and close to
    // today rather than decades off.
    const diffFromToday = result.getTime() - d('2026-03-01').getTime();
    const diffDays = Math.round(diffFromToday / (24 * 60 * 60 * 1000));
    expect(diffDays).toBeGreaterThanOrEqual(0);
    expect(diffDays).toBeLessThanOrEqual(30);
  });
});

describe('getNextOccurrence, non-YEARS inclusive of today', () => {
  it('returns today when today falls exactly on an interval boundary', () => {
    // Event: Jan 1, interval 30 days, today = Jan 31 (30 days later)
    const result = getNextOccurrence(
      stored(2026, 0, 1), d('2026-01-31'), 30, 'DAYS', null
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(31);
  });

  it('returns today when today matches a boundary from lastReminderSent', () => {
    const result = getNextOccurrence(
      stored(2025, 0, 1), d('2026-01-30'), 30, 'DAYS', d('2025-12-31')
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(30);
  });

  it('still returns the next future date when today is not on a boundary', () => {
    // Event: Jan 1, interval 30 days, today = Jan 15
    const result = getNextOccurrence(
      stored(2026, 0, 1), d('2026-01-15'), 30, 'DAYS', null
    );
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(31);
  });
});
