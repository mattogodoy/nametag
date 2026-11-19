import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importantDateFindMany: vi.fn(),
  personFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    importantDate: { findMany: mocks.importantDateFindMany },
    person: { findMany: mocks.personFindMany },
    user: { findUnique: mocks.userFindUnique },
  },
}));

vi.mock('@/lib/nameUtils', () => ({
  formatGraphName: (person: { name: string }) => person.name,
}));

vi.mock('@/lib/i18n-utils', () => ({
  getTranslationsForLocale: () => Promise.resolve((key: string) => key),
}));

vi.mock('@/lib/locale', () => ({
  getUserLocale: () => Promise.resolve('en'),
}));

import { getCalendarEvents, getOccurrenceDays, type OccurrenceSource } from '@/lib/calendar-events';
import {
  TIMEZONES,
  restoreTimezoneAfterEach,
  setProcessTimezone,
  storedCalendarDate,
  storedYearUnknownDate,
} from '../helpers/timezone';

restoreTimezoneAfterEach();

const JANUARY = 0;
const FEBRUARY = 1;
const MARCH = 2;
const APRIL = 3;
const MAY = 4;
const DECEMBER = 11;

/** Local calendar date for the stored day, the way the calendar reads it back. */
function day(year: number, monthIndex: number, dayOfMonth: number): Date {
  return new Date(year, monthIndex, dayOfMonth);
}

function source(overrides: Partial<OccurrenceSource> & Pick<OccurrenceSource, 'date'>): OccurrenceSource {
  return {
    type: null,
    reminderEnabled: false,
    reminderType: null,
    reminderInterval: null,
    reminderIntervalUnit: null,
    ...overrides,
  };
}

describe('getOccurrenceDays', () => {
  describe('predefined types', () => {
    it.each(['birthday', 'anniversary', 'nameday', 'memorial'])(
      'repeats a %s every year without any reminder',
      (type) => {
        const s = source({ date: day(1990, MAY, 12), type });
        expect(getOccurrenceDays(s, 2026, MAY)).toEqual([12]);
        expect(getOccurrenceDays(s, 2027, MAY)).toEqual([12]);
        expect(getOccurrenceDays(s, 2026, MARCH)).toEqual([]);
      }
    );

    it('does not show a birthday before the year it was born', () => {
      const s = source({ date: day(1990, MAY, 12), type: 'birthday' });
      expect(getOccurrenceDays(s, 1989, MAY)).toEqual([]);
      expect(getOccurrenceDays(s, 1990, MAY)).toEqual([12]);
    });

    it('stays yearly when a once-only reminder is set on a birthday', () => {
      const s = source({
        date: day(1990, MAY, 12),
        type: 'birthday',
        reminderEnabled: true,
        reminderType: 'ONCE',
      });
      expect(getOccurrenceDays(s, 2026, MAY)).toEqual([12]);
    });
  });

  describe('custom dates', () => {
    it('sits on its own day only when there is no reminder', () => {
      const s = source({ date: day(2020, MAY, 3) });
      expect(getOccurrenceDays(s, 2020, MAY)).toEqual([3]);
      expect(getOccurrenceDays(s, 2021, MAY)).toEqual([]);
      expect(getOccurrenceDays(s, 2019, MAY)).toEqual([]);
    });

    it('sits on its own day only for a once-only reminder', () => {
      const s = source({ date: day(2030, MAY, 3), reminderEnabled: true, reminderType: 'ONCE' });
      expect(getOccurrenceDays(s, 2030, MAY)).toEqual([3]);
      expect(getOccurrenceDays(s, 2031, MAY)).toEqual([]);
    });

    it('follows a yearly recurring reminder', () => {
      const s = source({
        date: day(2020, MAY, 3),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
      });
      expect(getOccurrenceDays(s, 2024, MAY)).toEqual([3]);
      expect(getOccurrenceDays(s, 2024, MARCH)).toEqual([]);
    });

    it('follows a recurring reminder every two years', () => {
      const s = source({
        date: day(2020, MAY, 3),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 2,
        reminderIntervalUnit: 'YEARS',
      });
      expect(getOccurrenceDays(s, 2022, MAY)).toEqual([3]);
      expect(getOccurrenceDays(s, 2023, MAY)).toEqual([]);
      expect(getOccurrenceDays(s, 2018, MAY)).toEqual([]);
    });

    it('follows a monthly recurring reminder and clamps to short months', () => {
      const s = source({
        date: day(2024, JANUARY, 31),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'MONTHS',
      });
      expect(getOccurrenceDays(s, 2024, JANUARY)).toEqual([31]);
      expect(getOccurrenceDays(s, 2025, FEBRUARY)).toEqual([28]);
      expect(getOccurrenceDays(s, 2023, DECEMBER)).toEqual([]);
    });

    it('follows a recurring reminder every three months', () => {
      const s = source({
        date: day(2024, JANUARY, 15),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 3,
        reminderIntervalUnit: 'MONTHS',
      });
      expect(getOccurrenceDays(s, 2024, APRIL)).toEqual([15]);
      expect(getOccurrenceDays(s, 2024, FEBRUARY)).toEqual([]);
    });

    it('lists every occurrence of a weekly reminder within the month', () => {
      const s = source({
        date: day(2024, JANUARY, 1),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'WEEKS',
      });
      expect(getOccurrenceDays(s, 2024, JANUARY)).toEqual([1, 8, 15, 22, 29]);
      expect(getOccurrenceDays(s, 2024, FEBRUARY)).toEqual([5, 12, 19, 26]);
    });

    it('lists every occurrence of a daily-interval reminder, starting at the saved day', () => {
      const s = source({
        date: day(2024, JANUARY, 10),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 10,
        reminderIntervalUnit: 'DAYS',
      });
      expect(getOccurrenceDays(s, 2024, JANUARY)).toEqual([10, 20, 30]);
      expect(getOccurrenceDays(s, 2024, FEBRUARY)).toEqual([9, 19, 29]);
    });

    it('defaults a recurring reminder without interval to yearly', () => {
      const s = source({ date: day(2020, MAY, 3), reminderEnabled: true, reminderType: 'RECURRING' });
      expect(getOccurrenceDays(s, 2021, MAY)).toEqual([3]);
    });
  });

  describe('February 29', () => {
    const leapBirthday = source({ date: day(2000, FEBRUARY, 29), type: 'birthday' });

    it('keeps the day in a leap year', () => {
      expect(getOccurrenceDays(leapBirthday, 2024, FEBRUARY)).toEqual([29]);
      expect(getOccurrenceDays(leapBirthday, 2024, MARCH)).toEqual([]);
    });

    it('moves to March 1 in a non-leap year, like the reminder does', () => {
      expect(getOccurrenceDays(leapBirthday, 2025, FEBRUARY)).toEqual([]);
      expect(getOccurrenceDays(leapBirthday, 2025, MARCH)).toEqual([1]);
    });
  });

  describe('year unknown', () => {
    it('repeats yearly, in any year', () => {
      const s = source({ date: day(1604, MAY, 12), type: 'birthday' });
      expect(getOccurrenceDays(s, 1950, MAY)).toEqual([12]);
      expect(getOccurrenceDays(s, 2026, MAY)).toEqual([12]);
    });

    it('repeats yearly even for a custom date with a once-only reminder', () => {
      const s = source({ date: day(1604, MAY, 12), reminderEnabled: true, reminderType: 'ONCE' });
      expect(getOccurrenceDays(s, 2026, MAY)).toEqual([12]);
    });
  });
});

describe('getCalendarEvents', () => {
  const person = {
    id: 'person-1',
    name: 'John',
    surname: 'Doe',
    nickname: null,
    displayNameOverride: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importantDateFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({ nameOrder: 'WESTERN', nameDisplayFormat: 'FULL' });
  });

  it('excludes soft-deleted dates and people from the queries', async () => {
    await getCalendarEvents('user-1', 2026, MAY);

    const dateWhere = mocks.importantDateFindMany.mock.calls[0][0].where;
    expect(dateWhere).toMatchObject({ deletedAt: null, person: { userId: 'user-1', deletedAt: null } });

    const personWhere = mocks.personFindMany.mock.calls[0][0].where;
    expect(personWhere).toMatchObject({ userId: 'user-1', deletedAt: null });
  });

  it('does not require a reminder for a date to be listed', async () => {
    await getCalendarEvents('user-1', 2026, MAY);

    expect(mocks.importantDateFindMany.mock.calls[0][0].where).not.toHaveProperty('reminderEnabled');
  });

  it.each(TIMEZONES)('puts a birthday on its stored day in %s', async (tz) => {
    setProcessTimezone(tz);
    mocks.importantDateFindMany.mockResolvedValue([
      {
        id: 'date-1',
        title: 'Birthday',
        type: 'birthday',
        date: storedCalendarDate('1990-05-12'),
        reminderEnabled: false,
        reminderType: null,
        reminderInterval: null,
        reminderIntervalUnit: null,
        person,
      },
    ]);

    const events = await getCalendarEvents('user-1', 2026, MAY);

    expect(events).toEqual([
      expect.objectContaining({
        personId: 'person-1',
        personName: 'John',
        type: 'important_date',
        title: 'types.birthday',
        day: 12,
      }),
    ]);
  });

  it.each(TIMEZONES)('puts a year-unknown birthday on its stored day in %s', async (tz) => {
    setProcessTimezone(tz);
    mocks.importantDateFindMany.mockResolvedValue([
      {
        id: 'date-1',
        title: 'Birthday',
        type: 'birthday',
        date: storedYearUnknownDate(new Date(2026, MAY, 12)),
        reminderEnabled: false,
        reminderType: null,
        reminderInterval: null,
        reminderIntervalUnit: null,
        person,
      },
    ]);

    const events = await getCalendarEvents('user-1', 2026, MAY);

    expect(events.map((event) => event.day)).toEqual([12]);
  });

  it('lists a contact reminder on the day it falls due', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        ...person,
        lastContact: storedCalendarDate('2026-04-01'),
        contactReminderInterval: 6,
        contactReminderIntervalUnit: 'WEEKS',
      },
    ]);

    const inDueMonth = await getCalendarEvents('user-1', 2026, MAY);
    expect(inDueMonth).toEqual([
      expect.objectContaining({ type: 'contact_reminder', titleKey: 'timeToCatchUp', title: null, day: 13 }),
    ]);

    const elsewhere = await getCalendarEvents('user-1', 2026, MARCH);
    expect(elsewhere).toEqual([]);
  });

  it('skips a contact reminder for someone never contacted', async () => {
    mocks.personFindMany.mockResolvedValue([
      { ...person, lastContact: null, contactReminderInterval: 1, contactReminderIntervalUnit: 'MONTHS' },
    ]);

    expect(await getCalendarEvents('user-1', 2026, MAY)).toEqual([]);
  });

  it('sorts events by day, then by name', async () => {
    const date = (id: string, name: string, dayOfMonth: number) => ({
      id,
      title: 'Birthday',
      type: 'birthday',
      date: storedCalendarDate(`1990-05-${String(dayOfMonth).padStart(2, '0')}`),
      reminderEnabled: false,
      reminderType: null,
      reminderInterval: null,
      reminderIntervalUnit: null,
      person: { ...person, id: `p-${id}`, name },
    });
    mocks.importantDateFindMany.mockResolvedValue([
      date('a', 'Zoe', 20),
      date('b', 'Ana', 20),
      date('c', 'Max', 3),
    ]);

    const events = await getCalendarEvents('user-1', 2026, MAY);

    expect(events.map((event) => event.personName)).toEqual(['Max', 'Ana', 'Zoe']);
  });
});
