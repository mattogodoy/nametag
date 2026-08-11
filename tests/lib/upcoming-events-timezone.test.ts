import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The dashboard renders `event.date` straight from `getUpcomingEvents`, so the
 * day a year-unknown birthday lands on is decided here, not in the page.
 *
 * These dates are stored as UTC midnight under year 1604, which predates
 * standard time zones. JavaScript falls back to Local Mean Time for it and puts
 * almost every zone west of UTC (Madrid -0:14:44, London -0:01:15), so reading
 * the stored day with local accessors moved it back a day for nearly everyone.
 */

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
  formatGraphName: () => 'John Doe',
}));

vi.mock('@/lib/i18n-utils', () => ({
  getTranslationsForLocale: () => Promise.resolve((key: string) => key),
}));

vi.mock('@/lib/locale', () => ({
  getUserLocale: () => Promise.resolve('en'),
}));

import { getUpcomingEvents } from '@/lib/upcoming-events';
import {
  TIMEZONES,
  setProcessTimezone,
  restoreTimezoneAfterEach,
  storedCalendarDate,
  storedYearUnknownDate,
} from '../helpers/timezone';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.personFindMany.mockResolvedValue([]);
  mocks.userFindUnique.mockResolvedValue({ nameOrder: 'WESTERN', language: 'en', nameDisplayFormat: 'FULL' });
});

restoreTimezoneAfterEach();

/** A year-unknown birthday as stored: UTC midnight under the sentinel year. */
function yearUnknownBirthdayOn(day: Date) {
  return {
    id: 'date-1',
    title: 'Birthday',
    type: 'BIRTHDAY',
    date: storedYearUnknownDate(day),
    reminderEnabled: true,
    reminderType: 'RECURRING',
    reminderInterval: 1,
    reminderIntervalUnit: 'YEARS',
    lastReminderSent: null,
    person: {
      id: 'person-1',
      name: 'John',
      surname: 'Doe',
      nickname: null,
      displayNameOverride: null,
      photo: null,
    },
  };
}

describe('getUpcomingEvents with year-unknown birthdays', () => {
  it.each(TIMEZONES)('keeps a birthday three days out on its own day in %s', async (tz) => {
    setProcessTimezone(tz);
    const target = new Date();
    target.setDate(target.getDate() + 3);
    mocks.importantDateFindMany.mockResolvedValue([yearUnknownBirthdayOn(target)]);

    const [event] = await getUpcomingEvents('user-1');

    expect(event.date.getMonth()).toBe(target.getMonth());
    expect(event.date.getDate()).toBe(target.getDate());
    expect(event.daysUntil).toBe(3);
    expect(event.isYearUnknown).toBe(true);
  });

  it.each(TIMEZONES)('reports a birthday today as zero days away in %s', async (tz) => {
    setProcessTimezone(tz);
    const today = new Date();
    mocks.importantDateFindMany.mockResolvedValue([yearUnknownBirthdayOn(today)]);

    const [event] = await getUpcomingEvents('user-1');

    expect(event.daysUntil).toBe(0);
    expect(event.date.getDate()).toBe(today.getDate());
  });
});

/** A person due for a catch-up, with lastContact as stored: UTC midnight. */
function personLastContactedOn(day: Date) {
  return {
    id: 'person-1',
    name: 'Jane',
    surname: 'Doe',
    nickname: null,
    displayNameOverride: null,
    photo: null,
    lastContact: storedCalendarDate(day),
    contactReminderInterval: 1,
    contactReminderIntervalUnit: 'MONTHS',
  };
}

describe('getUpcomingEvents contact reminders', () => {
  it.each(TIMEZONES)('puts the catch-up thirty days after the recorded day in %s', async (tz) => {
    setProcessTimezone(tz);
    const lastContactDay = new Date();
    lastContactDay.setDate(lastContactDay.getDate() - 10);
    mocks.importantDateFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([personLastContactedOn(lastContactDay)]);

    const [event] = await getUpcomingEvents('user-1');

    const expected = new Date(lastContactDay);
    expected.setDate(expected.getDate() + 30);
    expect(event.daysUntil).toBe(20);
    expect(event.date.getMonth()).toBe(expected.getMonth());
    expect(event.date.getDate()).toBe(expected.getDate());
  });

  it.each(TIMEZONES)('reports a catch-up due today as zero days away in %s', async (tz) => {
    setProcessTimezone(tz);
    const lastContactDay = new Date();
    lastContactDay.setDate(lastContactDay.getDate() - 30);
    mocks.importantDateFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([personLastContactedOn(lastContactDay)]);

    const [event] = await getUpcomingEvents('user-1');

    expect(event.daysUntil).toBe(0);
  });
});
