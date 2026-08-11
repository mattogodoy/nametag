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
});
