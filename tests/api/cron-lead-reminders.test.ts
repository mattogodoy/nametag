import { describe, it, expect, beforeEach, vi } from 'vitest';

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

function makeDate(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  const occurrence = new Date(today);
  occurrence.setDate(occurrence.getDate() + 7);

  return {
    id: 'date-1',
    personId: 'person-1',
    title: 'Birthday',
    type: 'birthday',
    date: new Date(1990, occurrence.getMonth(), occurrence.getDate()),
    reminderEnabled: true,
    reminderType: 'RECURRING',
    reminderInterval: 1,
    reminderIntervalUnit: 'YEARS',
    lastReminderSent: null,
    reminderLeadDays: null,
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
        email: 'user@example.com',
        dateFormat: 'MDY',
        language: 'en',
        nameOrder: 'WESTERN',
        nameDisplayFormat: 'FULL',
        defaultReminderLeadDays: 7,
      },
    },
    ...overrides,
  };
}

function makeDayOfDate(overrides: Record<string, unknown> = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return {
    id: 'date-A',
    personId: 'person-A',
    title: 'Anniversary',
    type: 'anniversary',
    date: new Date(today),
    reminderEnabled: true,
    reminderType: 'ONCE',
    reminderInterval: null,
    reminderIntervalUnit: null,
    lastReminderSent: null,
    reminderLeadDays: 0,
    lastLeadReminderSent: null,
    person: {
      id: 'person-A',
      name: 'Alice',
      surname: 'Ng',
      middleName: null,
      secondLastName: null,
      nickname: null,
      displayNameOverride: null,
      userId: 'user-A',
      user: {
        email: 'alice@example.com',
        dateFormat: 'MDY',
        language: 'en',
        nameOrder: 'WESTERN',
        nameDisplayFormat: 'FULL',
        defaultReminderLeadDays: 0,
      },
    },
    ...overrides,
  };
}

describe('send-reminders lead reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
    mocks.personFindMany.mockResolvedValue([]);
    mocks.importantDateUpdate.mockResolvedValue({});
  });

  const request = () => new Request('http://localhost/api/cron/send-reminders');

  it('sends a lead reminder when the user default puts today in the window', async () => {
    mocks.importantDateFindMany.mockResolvedValue([makeDate()]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });

    const response = await GET(request());
    const body = await response.json();

    expect(body.sent).toBe(1);
    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
  });

  it('stamps lastLeadReminderSent and not lastReminderSent', async () => {
    mocks.importantDateFindMany.mockResolvedValue([makeDate()]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });

    await GET(request());

    expect(mocks.importantDateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'date-1' },
        data: { lastLeadReminderSent: expect.any(Date) },
      })
    );
    expect(mocks.importantDateUpdate).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the per-date override is 0', async () => {
    mocks.importantDateFindMany.mockResolvedValue([makeDate({ reminderLeadDays: 0 })]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [] });

    const response = await GET(request());
    const body = await response.json();

    expect(body.sent).toBe(0);
  });

  it('does not stamp anything when the send fails', async () => {
    mocks.importantDateFindMany.mockResolvedValue([makeDate()]);
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: false, error: 'smtp down' }],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body.errors).toBe(1);
    expect(mocks.importantDateUpdate).not.toHaveBeenCalled();
  });

  it('stamps the correct column on the correct record when a batch mixes a day-of and a lead reminder', async () => {
    const dayOf = makeDayOfDate();
    const lead = makeDate({ id: 'date-B', person: { ...makeDate().person, id: 'person-B' } });

    mocks.importantDateFindMany.mockResolvedValue([dayOf, lead]);
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: true }, { success: true }],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(2);
    expect(body.sent).toBe(2);

    expect(mocks.importantDateUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.importantDateUpdate).toHaveBeenCalledWith({
      where: { id: 'date-A' },
      data: { lastReminderSent: expect.any(Date) },
    });
    expect(mocks.importantDateUpdate).toHaveBeenCalledWith({
      where: { id: 'date-B' },
      data: { lastLeadReminderSent: expect.any(Date) },
    });
  });

  it('queues no lead email for a recurring every-2-years date in an off year', async () => {
    const today = new Date();
    const occurrence = new Date(today);
    occurrence.setDate(occurrence.getDate() + 7);

    // Only one year has passed since the last actual day-of send, but the
    // interval is 2 years: the day-of path will not fire on this occurrence.
    const lastSentYear = occurrence.getFullYear() - 1;

    const offYearDate = makeDate({
      reminderInterval: 2,
      reminderIntervalUnit: 'YEARS',
      lastReminderSent: new Date(lastSentYear, occurrence.getMonth(), occurrence.getDate()),
    });

    mocks.importantDateFindMany.mockResolvedValue([offYearDate]);
    // Two results, not zero: if the guard regresses and queues the lead email
    // anyway, this must fail on the `sent` assertion below, not on an
    // out-of-bounds read into an empty results array.
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: true }, { success: true }],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body.sent).toBe(0);
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('queues a lead email for the same every-2-years date in an on year', async () => {
    const today = new Date();
    const occurrence = new Date(today);
    occurrence.setDate(occurrence.getDate() + 7);

    // Two years have passed since the last actual day-of send: the day-of
    // path will fire on this occurrence, so the lead email is allowed.
    const lastSentYear = occurrence.getFullYear() - 2;

    const onYearDate = makeDate({
      reminderInterval: 2,
      reminderIntervalUnit: 'YEARS',
      lastReminderSent: new Date(lastSentYear, occurrence.getMonth(), occurrence.getDate()),
    });

    mocks.importantDateFindMany.mockResolvedValue([onYearDate]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });

    const response = await GET(request());
    const body = await response.json();

    expect(body.sent).toBe(1);
    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
  });

  it('queues no lead email for a Feb 29 date evaluated in a non-leap year', async () => {
    // 2026 is not a leap year, so Feb 29 rolls to Mar 1 in getNextOccurrence.
    // Pin "today" a few days before that so the lead window would otherwise
    // be open.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 25));

    const feb29Date = makeDate({
      date: new Date(2020, 1, 29),
      reminderInterval: 1,
      reminderIntervalUnit: 'YEARS',
      lastReminderSent: null,
    });

    mocks.importantDateFindMany.mockResolvedValue([feb29Date]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [] });

    try {
      const response = await GET(request());
      const body = await response.json();

      expect(body.sent).toBe(0);
      expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stamps only the surviving record when the first email in a mixed batch fails', async () => {
    const dayOf = makeDayOfDate();
    const lead = makeDate({ id: 'date-B', person: { ...makeDate().person, id: 'person-B' } });

    mocks.importantDateFindMany.mockResolvedValue([dayOf, lead]);
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: false, error: 'smtp down' }, { success: true }],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body.sent).toBe(1);
    expect(body.errors).toBe(1);

    expect(mocks.importantDateUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.importantDateUpdate).toHaveBeenCalledWith({
      where: { id: 'date-B' },
      data: { lastLeadReminderSent: expect.any(Date) },
    });
    expect(mocks.importantDateUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'date-A' } })
    );
  });
});
