import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  getIntervalMs,
  shouldSendImportantDateReminder,
  shouldSendContactReminder,
  shouldSendLeadReminder,
} from '@/lib/reminders/due-dates';

const d = (iso: string) => new Date(`${iso}T00:00:00`);

describe('startOfDay', () => {
  it('zeroes the time without mutating the input', () => {
    const input = new Date('2026-05-12T15:30:00');
    const result = startOfDay(input);
    expect(result.getHours()).toBe(0);
    expect(input.getHours()).toBe(15);
  });
});

describe('getIntervalMs', () => {
  it('converts days', () => {
    expect(getIntervalMs(3, 'DAYS')).toBe(3 * 86400000);
  });

  it('converts weeks', () => {
    expect(getIntervalMs(2, 'WEEKS')).toBe(14 * 86400000);
  });

  it('approximates a month as 30 days', () => {
    expect(getIntervalMs(1, 'MONTHS')).toBe(30 * 86400000);
  });
});

describe('shouldSendImportantDateReminder, ONCE', () => {
  const base = {
    reminderType: 'ONCE' as const,
    reminderInterval: null,
    reminderIntervalUnit: null,
    lastReminderSent: null,
  };

  it('sends on the exact date', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: d('2026-05-12') }, d('2026-05-12'))
    ).toBe(true);
  });

  it('does not send on any other day', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: d('2026-05-12') }, d('2026-05-11'))
    ).toBe(false);
  });

  it('does not send twice on the same day', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: d('2026-05-12'), lastReminderSent: d('2026-05-12') },
        d('2026-05-12')
      )
    ).toBe(false);
  });
});

describe('shouldSendImportantDateReminder, RECURRING yearly', () => {
  const base = {
    reminderType: 'RECURRING' as const,
    reminderInterval: 1,
    reminderIntervalUnit: 'YEARS' as const,
    lastReminderSent: null,
  };

  it('sends on the anniversary of the original date', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: d('1990-05-12') }, d('2026-05-12'))
    ).toBe(true);
  });

  it('does not send on a non-anniversary day', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: d('1990-05-12') }, d('2026-05-13'))
    ).toBe(false);
  });

  it('does not send twice in the same year', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: d('1990-05-12'), lastReminderSent: d('2026-05-12') },
        d('2026-05-12')
      )
    ).toBe(false);
  });

  it('sends again the following year', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: d('1990-05-12'), lastReminderSent: d('2025-05-12') },
        d('2026-05-12')
      )
    ).toBe(true);
  });
});

describe('shouldSendContactReminder', () => {
  it('does not send without a reference date', () => {
    expect(
      shouldSendContactReminder(
        {
          lastContact: null,
          contactReminderInterval: 1,
          contactReminderIntervalUnit: 'MONTHS',
          lastContactReminderSent: null,
        },
        d('2026-05-12')
      )
    ).toBe(false);
  });

  it('sends once the interval has elapsed since last contact', () => {
    expect(
      shouldSendContactReminder(
        {
          lastContact: d('2026-01-01'),
          contactReminderInterval: 1,
          contactReminderIntervalUnit: 'MONTHS',
          lastContactReminderSent: null,
        },
        d('2026-05-12')
      )
    ).toBe(true);
  });

  it('does not send before the interval has elapsed', () => {
    expect(
      shouldSendContactReminder(
        {
          lastContact: d('2026-05-01'),
          contactReminderInterval: 1,
          contactReminderIntervalUnit: 'MONTHS',
          lastContactReminderSent: null,
        },
        d('2026-05-12')
      )
    ).toBe(false);
  });
});

describe('shouldSendImportantDateReminder, RECURRING yearly, Feb 29 birthday', () => {
  const base = {
    reminderType: 'RECURRING' as const,
    reminderInterval: 1,
    reminderIntervalUnit: 'YEARS' as const,
    lastReminderSent: null,
  };
  // A birthday actually recorded on a leap day.
  const feb29 = new Date(1992, 1, 29);

  it('never fires during a non-leap year, because Feb 29 does not exist on the calendar that year', () => {
    // Surprising: there is no "closest day" fallback to Feb 28 or Mar 1. The
    // YEARS branch requires today's month/day to exactly equal the event's
    // month/day, and that day simply does not occur in a non-leap year, so
    // the reminder is silently skipped 3 years out of 4.
    expect(shouldSendImportantDateReminder({ ...base, date: feb29 }, d('2026-02-28'))).toBe(false);
    expect(shouldSendImportantDateReminder({ ...base, date: feb29 }, d('2026-03-01'))).toBe(false);
  });

  it('fires again on Feb 29 of the next leap year', () => {
    expect(shouldSendImportantDateReminder({ ...base, date: feb29 }, d('2028-02-29'))).toBe(true);
  });
});

describe('shouldSendImportantDateReminder, RECURRING non-YEARS interval, unknown-year sentinel (year <= 1604)', () => {
  const base = {
    reminderType: 'RECURRING' as const,
    reminderInterval: 1,
    reminderIntervalUnit: 'MONTHS' as const,
    lastReminderSent: null,
  };
  // year <= 1604 marks "we only know the month and day, not the year" (e.g. a
  // birthday with an unknown year). Constructed with three numeric arguments
  // where the year is outside 0-99, so there is no Date year-1900 remapping
  // to account for; getFullYear() reports exactly 1604.
  const unknownYearDate = new Date(1604, 4, 15); // May 15, unknown year

  it('anchors to this year\'s occurrence once it has arrived', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: unknownYearDate }, d('2026-05-15'))
    ).toBe(true);
  });

  it('does not fire well before this year\'s occurrence, when the code falls back to last year as the anchor', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: unknownYearDate }, d('2026-01-01'))
    ).toBe(false);
  });

  it('fires 5 days early because 1 MONTH is approximated as 30 days, drifting off the true May 15 anniversary', () => {
    // Surprising and worth flagging: when today is still before this year's
    // May 15, the code anchors to last year's May 15 (2025) and counts
    // forward in fixed 30-day steps. 12 steps of 30 days is 360 days, five
    // days short of the real 365-day gap to this year's May 15, so the count
    // lands on May 10, 2026, not May 15. shouldSendImportantDateReminder
    // returns true on May 10 for this never-sent reminder, meaning the
    // sentinel path fires a genuinely different day than the actual
    // anniversary. Because both May 10 (via the drifted, reduced-year
    // anchor) and May 15 (via the fresh, non-reduced anchor evaluated on
    // that exact day, see the test above) return true, the interval math has
    // two distinct "hit" days within the same yearly cycle for this
    // never-sent reminder. In production, whichever day the cron job first
    // observes as true wins and populates lastReminderSent, after which
    // subsequent checks compare against that lastReminderSent date instead
    // of re-deriving the anchor, so the reminder does not fire twice in the
    // same cycle. But every future occurrence keeps counting in 30-day steps
    // from whatever day it first fired, so the drift compounds year over
    // year rather than resyncing to the calendar day of the actual event.
    expect(
      shouldSendImportantDateReminder({ ...base, date: unknownYearDate }, d('2026-05-10'))
    ).toBe(true);
  });
});

describe('shouldSendLeadReminder', () => {
  const occurrence = d('2026-05-12');

  it('fires on the exact lead day', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-05'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(true);
  });

  it('does not fire before the window opens', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-04'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(false);
  });

  // Catch-up: the user set a 7-day lead when the event was already 4 days out.
  // Telling them late beats not telling them at all.
  it('fires mid-window when it has not fired for this occurrence yet', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-08'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(true);
  });

  it('does not fire again later in the same window', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-08'),
        leadDays: 7,
        lastLeadReminderSent: d('2026-05-05'),
      })
    ).toBe(false);
  });

  it('fires again next year, since the previous send predates this window', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-05'),
        leadDays: 7,
        lastLeadReminderSent: d('2025-05-05'),
      })
    ).toBe(true);
  });

  // The day-of email owns the event day. A lead email there would duplicate it.
  it('does not fire on the occurrence day itself', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: occurrence,
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(false);
  });

  it('does not fire after the occurrence has passed', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-13'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(false);
  });

  it('never fires when lead days is 0', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: occurrence,
        today: d('2026-05-12'),
        leadDays: 0,
        lastLeadReminderSent: null,
      })
    ).toBe(false);
  });

  it('handles a window that crosses a month boundary', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-06-03'),
        today: d('2026-05-27'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(true);
  });

  it('handles a 30 day window that crosses a year boundary', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2027-01-10'),
        today: d('2026-12-11'),
        leadDays: 30,
        lastLeadReminderSent: null,
      })
    ).toBe(true);
  });
});
