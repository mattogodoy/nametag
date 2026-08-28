import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLocalDateString } from '../../lib/date-format';
import {
  storedCalendarDate,
  storedYearUnknownDate,
  setProcessTimezone,
  restoreTimezoneAfterEach,
} from '../helpers/timezone';

/**
 * Pins the `date` field carried on every notification envelope, which the
 * webhook channel publishes verbatim as a machine-readable calendar date (see
 * lib/notifications/channels/webhook.ts's payloadData).
 *
 * `dispatchAll` is mocked rather than exercised for real so these tests can
 * inspect the envelope the cron actually builds, before any channel-specific
 * serialization, which is the one place both bugs this pins down originate:
 * a stored value standing in for an occurrence, and a year-unknown date
 * asserting the sentinel year as real.
 */

const mocks = vi.hoisted(() => ({
  importantDateFindMany: vi.fn(),
  importantDateUpdate: vi.fn(),
  personFindMany: vi.fn(),
  cronLogCreate: vi.fn(),
  cronLogUpdate: vi.fn(),
  dispatchAll: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    importantDate: {
      findMany: mocks.importantDateFindMany,
      update: mocks.importantDateUpdate,
    },
    person: { findMany: mocks.personFindMany, update: vi.fn() },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    notificationEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
    cronJobLog: { create: mocks.cronLogCreate, update: mocks.cronLogUpdate },
  },
}));

vi.mock('../../lib/notifications/dispatch', () => ({
  dispatchAll: mocks.dispatchAll,
}));

vi.mock('../../lib/unsubscribe-tokens', () => ({
  createUnsubscribeToken: vi.fn(() => Promise.resolve('tok-123')),
}));

vi.mock('../../lib/shared-secret', () => ({ hasValidBearerSecret: () => true }));

import { GET } from '../../app/api/cron/send-reminders/route';

const request = () => new Request('http://localhost/api/cron/send-reminders');

function birthdayRecord(storedDate: Date) {
  return {
    id: 'date-1',
    personId: 'person-1',
    title: 'Birthday',
    type: 'birthday',
    date: storedDate,
    reminderEnabled: true,
    reminderType: 'RECURRING',
    reminderInterval: 1,
    reminderIntervalUnit: 'YEARS',
    lastReminderSent: null,
    // Zero, and the user default below is also zero, so resolveLeadDays
    // yields 0 and no important_date_lead envelope is produced alongside
    // the day-of one: these tests isolate the day-of `date` field.
    reminderLeadDays: 0,
    lastLeadReminderSent: null,
    person: {
      id: 'person-1',
      name: 'Sarah',
      surname: 'Chen',
      middleName: null,
      secondLastName: null,
      nickname: null,
      displayNameOverride: null,
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'sarah@example.com',
        dateFormat: 'MDY',
        language: 'en',
        nameOrder: 'WESTERN',
        nameDisplayFormat: 'FULL',
        defaultReminderLeadDays: 0,
      },
    },
  };
}

function today(): Date {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * Like `birthdayRecord`, but with a non-zero lead window so
 * shouldSendLeadReminder fires an important_date_lead envelope instead of (or
 * alongside) the day-of one.
 */
function leadBirthdayRecord(storedDate: Date, leadDays: number) {
  return {
    ...birthdayRecord(storedDate),
    reminderLeadDays: leadDays,
  };
}

describe('the notification envelope date field for a day-of important-date reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
    mocks.personFindMany.mockResolvedValue([]);
    mocks.importantDateUpdate.mockResolvedValue({});
    mocks.dispatchAll.mockImplementation(async (envelopes: unknown[]) =>
      envelopes.map(() => ({ delivered: 1, failed: 0, skipped: 0, shouldStamp: true }))
    );
  });

  it('reports the occurrence day (today), not the year the birthday was originally stored under', async () => {
    // Stored under a birth year far from today, so a bug that echoed the
    // stored value back would show up as a wrong year, not just a wrong
    // format.
    const birthYear = 1990;
    const day = today();
    mocks.importantDateFindMany.mockResolvedValue([
      birthdayRecord(storedCalendarDate(new Date(birthYear, day.getMonth(), day.getDate()))),
    ]);

    await GET(request());

    expect(mocks.dispatchAll).toHaveBeenCalledTimes(1);
    const envelopes = mocks.dispatchAll.mock.calls[0][0] as Array<{
      notification: { kind: string; date?: string };
    }>;
    const envelope = envelopes.find((e) => e.notification.kind === 'important_date');
    expect(envelope).toBeDefined();
    // The occurrence is today, and today is what a day-of reminder always
    // fires on: the stored birth year must never surface here.
    expect(envelope?.notification.date).toBe(getLocalDateString(day));
    expect(envelope?.notification.date).not.toContain(String(birthYear));
  });

  it('never emits the year-unknown sentinel (1604), even though the stored row carries it', async () => {
    const day = today();
    mocks.importantDateFindMany.mockResolvedValue([
      birthdayRecord(storedYearUnknownDate(day)),
    ]);

    await GET(request());

    expect(mocks.dispatchAll).toHaveBeenCalledTimes(1);
    const envelopes = mocks.dispatchAll.mock.calls[0][0] as Array<{
      notification: { kind: string; date?: string };
    }>;
    const envelope = envelopes.find((e) => e.notification.kind === 'important_date');
    expect(envelope).toBeDefined();
    // The occurrence is always projected into a real year, so the sentinel
    // that marks an unknown year on the stored row must never reach a
    // receiver parsing this field as a real calendar date.
    expect(envelope?.notification.date).not.toContain('1604');
    expect(envelope?.notification.date).toBe(getLocalDateString(day));
  });
});

/**
 * The lead path is where the real UTC-to-local conversion happens: a stored
 * UTC-midnight Date goes through parseCalendarDate, then getNextOccurrence
 * projects it into this year's (or next year's) occurrence, then
 * getLocalDateString formats the result. The day-of path above only ever
 * pins `today` itself, which never round-trips through the stored value at
 * all, so it cannot catch a helper mistake in that pipeline. Run under a
 * timezone west of UTC, where `parseAsLocalDate` given a raw Date (the wrong
 * helper for a UTC-midnight column) would report the previous day.
 */
describe('the notification envelope date field for an important-date lead reminder', () => {
  restoreTimezoneAfterEach();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
    mocks.personFindMany.mockResolvedValue([]);
    mocks.importantDateUpdate.mockResolvedValue({});
    mocks.dispatchAll.mockImplementation(async (envelopes: unknown[]) =>
      envelopes.map(() => ({ delivered: 1, failed: 0, skipped: 0, shouldStamp: true }))
    );
  });

  it('reports the projected occurrence date, not the day it shifts to under a UTC helper mistake', async () => {
    // withTimezone's finally block restores the timezone as soon as the
    // (synchronous part of the) callback returns, which is wrong for an
    // async handler: the restore would run before GET actually finishes.
    // Set it directly instead, and let restoreTimezoneAfterEach above clean
    // up once this test, awaited in full, has completed.
    setProcessTimezone('America/New_York');

    const day = today();
    // Five days out: inside a 7-day lead window, and far enough from today
    // that a west-of-UTC off-by-one day would change the calendar date
    // rather than silently landing on the same day by coincidence.
    const occurrence = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 5);
    const birthYear = 1990;
    const storedDate = storedCalendarDate(
      new Date(birthYear, occurrence.getMonth(), occurrence.getDate())
    );

    mocks.importantDateFindMany.mockResolvedValue([leadBirthdayRecord(storedDate, 7)]);

    await GET(request());

    expect(mocks.dispatchAll).toHaveBeenCalledTimes(1);
    const envelopes = mocks.dispatchAll.mock.calls[0][0] as Array<{
      notification: { kind: string; date?: string; daysUntil?: number };
    }>;
    const envelope = envelopes.find((e) => e.notification.kind === 'important_date_lead');
    expect(envelope).toBeDefined();
    expect(envelope?.notification.daysUntil).toBe(5);
    // The exact projected calendar day, this year, never the birth year and
    // never shifted a day earlier by a UTC/local mismatch.
    expect(envelope?.notification.date).toBe(getLocalDateString(occurrence));
    expect(envelope?.notification.date).not.toContain(String(birthYear));
  });
});
