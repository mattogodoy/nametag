import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UpcomingEvent } from '../../lib/upcoming-events';

const mocks = vi.hoisted(() => ({
  importantDateFindMany: vi.fn(),
  importantDateUpdate: vi.fn(),
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  userFindMany: vi.fn(),
  userUpdate: vi.fn(),
  cronLogCreate: vi.fn(),
  cronLogUpdate: vi.fn(),
  sendEmailBatch: vi.fn(),
  getUpcomingEvents: vi.fn(),
  getNextOccurrence: vi.fn(),
  getDaysUntil: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    importantDate: {
      findMany: mocks.importantDateFindMany,
      update: mocks.importantDateUpdate,
    },
    person: { findMany: mocks.personFindMany, update: mocks.personUpdate },
    user: { findMany: mocks.userFindMany, update: mocks.userUpdate },
    cronJobLog: { create: mocks.cronLogCreate, update: mocks.cronLogUpdate },
  },
}));

vi.mock('../../lib/email', async () => {
  const actual = await vi.importActual<typeof import('../../lib/email')>('../../lib/email');
  return { ...actual, sendEmailBatch: mocks.sendEmailBatch };
});

vi.mock('../../lib/upcoming-events', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/upcoming-events')>('../../lib/upcoming-events');
  return { ...actual, getUpcomingEvents: mocks.getUpcomingEvents };
});

vi.mock('../../lib/unsubscribe-tokens', () => ({
  createUnsubscribeToken: vi.fn(() => Promise.resolve('tok-123')),
}));

vi.mock('../../lib/shared-secret', () => ({ hasValidBearerSecret: () => true }));

vi.mock('../../lib/features', async () => {
  const actual = await vi.importActual<typeof import('../../lib/features')>('../../lib/features');
  return { ...actual, isSaasMode: () => false };
});

import { GET } from '../../app/api/cron/send-reminders/route';

const TODAY = new Date();

function digestUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: true,
    language: 'en',
    dateFormat: 'MDY',
    weeklyDigestEnabled: true,
    // Default to today's weekday so the digest is due unless a test overrides it.
    weeklyDigestWeekday: TODAY.getDay(),
    lastWeeklyDigestSent: null,
    ...overrides,
  };
}

function upcoming(daysUntil: number, id = `e-${daysUntil}`): UpcomingEvent {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + daysUntil);
  return {
    id,
    personId: 'person-1',
    personName: 'Sarah Chen',
    type: 'important_date',
    title: 'Birthday',
    titleKey: null,
    date,
    daysUntil,
    isYearUnknown: false,
    personPhoto: null,
  };
}

describe('send-reminders weekly digest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
    mocks.importantDateFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([]);
    mocks.userUpdate.mockResolvedValue({});
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });
  });

  const request = () => new Request('http://localhost/api/cron/send-reminders');

  it('sends one digest to a user whose weekday matches and who has events', async () => {
    mocks.userFindMany.mockResolvedValue([digestUser()]);
    mocks.getUpcomingEvents.mockResolvedValue([upcoming(1), upcoming(4)]);

    await GET(request());

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0][0].to).toBe('user@example.com');
  });

  it('sends nothing when today is not the chosen weekday', async () => {
    const otherWeekday = (TODAY.getDay() + 3) % 7;
    mocks.userFindMany.mockResolvedValue([
      digestUser({ weeklyDigestWeekday: otherWeekday }),
    ]);
    mocks.getUpcomingEvents.mockResolvedValue([upcoming(1)]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [] });

    await GET(request());

    expect(mocks.getUpcomingEvents).not.toHaveBeenCalled();
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('sends nothing and stamps nothing when the week is empty', async () => {
    mocks.userFindMany.mockResolvedValue([digestUser()]);
    mocks.getUpcomingEvents.mockResolvedValue([]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [] });

    await GET(request());

    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('stamps lastWeeklyDigestSent on a successful send', async () => {
    mocks.userFindMany.mockResolvedValue([digestUser()]);
    mocks.getUpcomingEvents.mockResolvedValue([upcoming(2)]);

    await GET(request());

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastWeeklyDigestSent: expect.any(Date) },
    });
  });

  it('does not stamp lastWeeklyDigestSent when the send fails', async () => {
    mocks.userFindMany.mockResolvedValue([digestUser()]);
    mocks.getUpcomingEvents.mockResolvedValue([upcoming(2)]);
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: false, error: 'smtp down' }],
    });

    await GET(request());

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('leaves overdue contact reminders out of the email', async () => {
    const overdue: UpcomingEvent = {
      ...upcoming(-40, 'e-overdue'),
      type: 'contact_reminder',
      title: null,
      titleKey: 'timeToCatchUp',
      personName: 'Overdue Person',
    };
    mocks.userFindMany.mockResolvedValue([digestUser()]);
    mocks.getUpcomingEvents.mockResolvedValue([overdue, upcoming(2)]);

    await GET(request());

    const sentHtml = mocks.sendEmailBatch.mock.calls[0][0][0].html;
    expect(sentHtml).toContain('Sarah Chen');
    expect(sentHtml).not.toContain('Overdue Person');
  });

  it('skips only the user whose getUpcomingEvents call throws, not the users queued after them', async () => {
    const user1 = digestUser({ id: 'user-1', email: 'one@example.com' });
    const user2 = digestUser({ id: 'user-2', email: 'two@example.com' });
    const user3 = digestUser({ id: 'user-3', email: 'three@example.com' });

    mocks.userFindMany.mockResolvedValue([user1, user2, user3]);
    mocks.getUpcomingEvents.mockImplementation((userId: string) => {
      if (userId === 'user-2') {
        return Promise.reject(new Error('malformed record'));
      }
      return Promise.resolve([upcoming(2, `e-${userId}`)]);
    });
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: true }, { success: true }],
    });

    await GET(request());

    // Against pass-level try/catch, the throw on user-2 aborts the loop
    // entirely and user-3 is never attempted. With per-user isolation,
    // both user-1 and user-3 still get their digest.
    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    const sentEmails = mocks.sendEmailBatch.mock.calls[0][0] as Array<{ to: string }>;
    expect(sentEmails).toHaveLength(2);
    expect(sentEmails.map((e) => e.to)).toEqual(['one@example.com', 'three@example.com']);
  });

  it('stamps the two surviving users and not the one whose digest failed mid-loop', async () => {
    const user1 = digestUser({ id: 'user-1', email: 'one@example.com' });
    const user2 = digestUser({ id: 'user-2', email: 'two@example.com' });
    const user3 = digestUser({ id: 'user-3', email: 'three@example.com' });

    mocks.userFindMany.mockResolvedValue([user1, user2, user3]);
    mocks.getUpcomingEvents.mockImplementation((userId: string) => {
      if (userId === 'user-2') {
        return Promise.reject(new Error('malformed record'));
      }
      return Promise.resolve([upcoming(2, `e-${userId}`)]);
    });
    mocks.sendEmailBatch.mockResolvedValue({
      results: [{ success: true }, { success: true }],
    });

    await GET(request());

    expect(mocks.userUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { lastWeeklyDigestSent: expect.any(Date) },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-3' },
      data: { lastWeeklyDigestSent: expect.any(Date) },
    });
    expect(mocks.userUpdate).not.toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { lastWeeklyDigestSent: expect.any(Date) },
    });
  });

  it('lets day-of, lead, and contact reminders send when the digest candidate query itself fails', async () => {
    mocks.userFindMany.mockRejectedValue(new Error('db unreachable'));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfImportantDate = {
      id: 'date-day-of',
      personId: 'person-day',
      title: 'Anniversary',
      type: 'anniversary',
      // Stored as UTC midnight on today's calendar day, matching how the
      // database holds calendar dates and how parseCalendarDate reads them.
      date: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
      reminderEnabled: true,
      reminderType: 'ONCE',
      reminderInterval: null,
      reminderIntervalUnit: null,
      lastReminderSent: null,
      reminderLeadDays: 0,
      lastLeadReminderSent: null,
      person: {
        id: 'person-day',
        name: 'Dana',
        surname: 'Kim',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
        userId: 'user-dayof',
        user: {
          email: 'dana@example.com',
          dateFormat: 'MDY',
          language: 'en',
          nameOrder: 'WESTERN',
          nameDisplayFormat: 'FULL',
          defaultReminderLeadDays: 0,
        },
      },
    };

    mocks.importantDateFindMany.mockResolvedValue([dayOfImportantDate]);
    mocks.sendEmailBatch.mockResolvedValue({ results: [{ success: true }] });

    const response = await GET(request());
    const body = await response.json();

    // The candidate query itself failed, so no digest work was even attempted,
    // but the day-of reminder collected earlier in the route must still send.
    expect(mocks.getUpcomingEvents).not.toHaveBeenCalled();
    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0][0].to).toBe('dana@example.com');
    expect(body.sent).toBe(1);
    expect(body.digestsSent).toBe(0);
  });
});
