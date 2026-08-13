import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  getIntervalMs,
  shouldSendImportantDateReminder,
  shouldSendContactReminder,
  shouldSendLeadReminder,
} from '@/lib/reminders/due-dates';

/** A local calendar day, as `today` and sent-timestamps are produced at runtime. */
const d = (iso: string) => new Date(`${iso}T00:00:00`);

/**
 * A stored calendar date. The database keeps these as UTC midnight and
 * `parseCalendarDate` reads their UTC components, so fixtures must be built the
 * same way. Using local midnight here shifts the day in most time zones.
 */
const stored = (y: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(y, monthIndex, day));

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
      shouldSendImportantDateReminder({ ...base, date: stored(2026, 4, 12) }, d('2026-05-12'))
    ).toBe(true);
  });

  it('does not send on any other day', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: stored(2026, 4, 12) }, d('2026-05-11'))
    ).toBe(false);
  });

  it('does not send twice on the same day', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: stored(2026, 4, 12), lastReminderSent: d('2026-05-12') },
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
      shouldSendImportantDateReminder({ ...base, date: stored(1990, 4, 12) }, d('2026-05-12'))
    ).toBe(true);
  });

  it('does not send on a non-anniversary day', () => {
    expect(
      shouldSendImportantDateReminder({ ...base, date: stored(1990, 4, 12) }, d('2026-05-13'))
    ).toBe(false);
  });

  it('does not send twice in the same year', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: stored(1990, 4, 12), lastReminderSent: d('2026-05-12') },
        d('2026-05-12')
      )
    ).toBe(false);
  });

  it('sends again the following year', () => {
    expect(
      shouldSendImportantDateReminder(
        { ...base, date: stored(1990, 4, 12), lastReminderSent: d('2025-05-12') },
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
  const feb29 = stored(1992, 1, 29);

  it('fires on March 1 during a non-leap year', () => {
    // The anniversary is projected into the current year with the Date
    // constructor, which rolls February 29 to March 1 when the year is not a
    // leap year. That matches getNextOccurrence, so the dashboard, the day-of
    // email and the advance-notice email all agree on the same day.
    expect(shouldSendImportantDateReminder({ ...base, date: feb29 }, d('2026-02-28'))).toBe(false);
    expect(shouldSendImportantDateReminder({ ...base, date: feb29 }, d('2026-03-01'))).toBe(true);
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
  const unknownYearDate = stored(1604, 4, 15); // May 15, unknown year

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

// Re-arming works by checking that the previous send predates the current
// window. That only holds while windows are disjoint. A lead longer than the
// recurrence interval would reach back past the previous occurrence, so the
// previous send would sit inside the current window and suppress it. Clamping
// the lead to the interval keeps the windows from touching.
describe('shouldSendLeadReminder, lead longer than the recurrence interval', () => {
  it('still fires for the next occurrence when the unclamped window would swallow the last send', () => {
    // Every 3 days, but a 7-day lead. Occurrence on the 12th, the previous one
    // was the 9th, and its lead email went out on the 6th. Unclamped, this
    // window opens on the 5th and the 6th send blocks it.
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-05-12'),
        today: d('2026-05-09'),
        leadDays: 7,
        lastLeadReminderSent: d('2026-05-06'),
        intervalDays: 3,
      })
    ).toBe(true);
  });

  it('still suppresses a second send inside the clamped window', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-05-12'),
        today: d('2026-05-10'),
        leadDays: 7,
        lastLeadReminderSent: d('2026-05-09'),
        intervalDays: 3,
      })
    ).toBe(false);
  });

  it('does not open the window earlier than the clamp allows', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-05-12'),
        today: d('2026-05-08'),
        leadDays: 7,
        lastLeadReminderSent: null,
        intervalDays: 3,
      })
    ).toBe(false);
  });

  it('leaves the full lead intact when the interval is longer', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-05-12'),
        today: d('2026-05-05'),
        leadDays: 7,
        lastLeadReminderSent: null,
        intervalDays: 365,
      })
    ).toBe(true);
  });

  it('leaves the full lead intact when no interval is supplied, as for ONCE', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-05-12'),
        today: d('2026-05-05'),
        leadDays: 7,
        lastLeadReminderSent: null,
        intervalDays: null,
      })
    ).toBe(true);
  });

  // Every occurrence in a fast-recurring series should get exactly one advance
  // email, rather than every other one.
  it('fires for each occurrence in a run of alternating windows', () => {
    let lastLeadReminderSent: Date | null = null;
    const fired: string[] = [];

    // Occurrences every 3 days from the 12th, lead clamped to 3.
    for (const occurrenceIso of ['2026-05-12', '2026-05-15', '2026-05-18']) {
      const nextOccurrence = d(occurrenceIso);
      // Walk the three days before each occurrence.
      for (let offset = 3; offset >= 1; offset--) {
        const today = new Date(nextOccurrence);
        today.setDate(today.getDate() - offset);
        if (
          shouldSendLeadReminder({
            nextOccurrence,
            today,
            leadDays: 7,
            lastLeadReminderSent,
            intervalDays: 3,
          })
        ) {
          fired.push(occurrenceIso);
          lastLeadReminderSent = today;
        }
      }
    }

    expect(fired).toEqual(['2026-05-12', '2026-05-15', '2026-05-18']);
  });
});

// The path that was silently broken before calendar-date reads landed: the
// stored value is UTC midnight, and comparing it against a local-midnight
// `today` suppressed the email everywhere except UTC. Fixtures use `stored()`
// so a regression shows up rather than being masked by local construction.
describe('ONCE important date with a lead time', () => {
  const date = stored(2026, 5, 15); // 15 June 2026
  const once = {
    date,
    reminderType: 'ONCE' as const,
    reminderInterval: null,
    reminderIntervalUnit: null,
    lastReminderSent: null,
  };

  it('agrees the day-of email would fire on the occurrence', () => {
    expect(shouldSendImportantDateReminder(once, d('2026-06-15'))).toBe(true);
  });

  it('sends the advance email on the lead day', () => {
    expect(
      shouldSendLeadReminder({
        nextOccurrence: d('2026-06-15'),
        today: d('2026-06-08'),
        leadDays: 7,
        lastLeadReminderSent: null,
      })
    ).toBe(true);
  });
});
