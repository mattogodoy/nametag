import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TIMEZONES,
  setProcessTimezone,
  restoreTimezoneAfterEach,
  storedCalendarDate,
  storedYearUnknownDate,
} from '../helpers/timezone';

/**
 * These assert the date string that actually lands in the email body.
 *
 * Nothing else in the reminder suite inspects a formatted date, and the two
 * lead/digest call sites hand the formatter a Date that is already anchored to
 * local midnight rather than a stored UTC one. Applying the UTC-to-local
 * correction to such a value a second time reports the previous day, but only
 * east of UTC, so a UTC-only run cannot see it. Hence the timezone sweep.
 */

const mocks = vi.hoisted(() => ({
  importantDateFindMany: vi.fn(),
  importantDateUpdate: vi.fn(),
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  cronLogCreate: vi.fn(),
  cronLogUpdate: vi.fn(),
  sendEmailBatch: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    importantDate: {
      findMany: mocks.importantDateFindMany,
      update: mocks.importantDateUpdate,
    },
    person: { findMany: mocks.personFindMany, update: mocks.personUpdate },
    // dispatch.ts reads emailRemindersEnabled through this. An empty result
    // means every user defaults to email-enabled, so behaviour here is
    // unchanged.
    user: { findMany: vi.fn().mockResolvedValue([]) },
    // dispatch.ts also reads configured ntfy endpoints through this. An empty
    // result means no endpoints, so behaviour here is unchanged.
    notificationEndpoint: { findMany: vi.fn().mockResolvedValue([]) },
    cronJobLog: { create: mocks.cronLogCreate, update: mocks.cronLogUpdate },
  },
}));

vi.mock('../../lib/email', async () => {
  const actual = await vi.importActual<typeof import('../../lib/email')>('../../lib/email');
  return { ...actual, sendEmailBatch: mocks.sendEmailBatch };
});

vi.mock('../../lib/unsubscribe-tokens', () => ({
  createUnsubscribeToken: vi.fn(() => Promise.resolve('tok-123')),
}));

vi.mock('../../lib/shared-secret', () => ({ hasValidBearerSecret: () => true }));

import { GET } from '../../app/api/cron/send-reminders/route';

const request = () => new Request('http://localhost/api/cron/send-reminders');

/** The single email body handed to the provider. */
function sentBody(): string {
  const items = mocks.sendEmailBatch.mock.calls[0][0];
  expect(items).toHaveLength(1);
  return items[0].html as string;
}

function leadDate(storedDate: Date) {
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
    reminderLeadDays: 7,
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

describe('advance-notice email, date shown in the body', () => {
  restoreTimezoneAfterEach();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
    mocks.personFindMany.mockResolvedValue([]);
    mocks.importantDateUpdate.mockResolvedValue({});
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });
  });

  /** The occurrence the advance notice is about: seven days from today. */
  function occurrenceInSevenDays(): Date {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + 7);
    return day;
  }

  for (const tz of TIMEZONES) {
    it(`names the occurrence day, not the day before it (${tz})`, async () => {
      setProcessTimezone(tz);
      const occurrence = occurrenceInSevenDays();

      mocks.importantDateFindMany.mockResolvedValue([
        leadDate(storedCalendarDate(new Date(1990, occurrence.getMonth(), occurrence.getDate()))),
      ]);

      await GET(request());

      const month = occurrence.toLocaleDateString('en-US', { month: 'long' });
      expect(sentBody()).toContain(`${month} ${occurrence.getDate()}`);
    });

    // A year-unknown birthday is stored under the sentinel year, and the lead
    // path projects it into the year it next falls in, so the sentinel is gone
    // by the time the formatter sees it. The email must still state no year.
    it(`omits the year for a year-unknown date (${tz})`, async () => {
      setProcessTimezone(tz);
      const occurrence = occurrenceInSevenDays();

      mocks.importantDateFindMany.mockResolvedValue([
        leadDate(storedYearUnknownDate(occurrence)),
      ]);

      await GET(request());

      const body = sentBody();
      const month = occurrence.toLocaleDateString('en-US', { month: 'long' });
      expect(body).toContain(`${month} ${occurrence.getDate()}`);
      expect(body).not.toContain(
        `${month} ${occurrence.getDate()}, ${occurrence.getFullYear()}`
      );
      expect(body).not.toContain('1604');
    });
  }
});
