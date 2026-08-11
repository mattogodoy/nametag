import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  getIntervalMs,
  shouldSendImportantDateReminder,
  shouldSendContactReminder,
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
