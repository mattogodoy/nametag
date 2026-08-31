import { describe, it, expect } from 'vitest';
import { renderEmail } from '../../../lib/notifications/channels/email';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

function envelope(
  notification: NotificationEnvelope['notification'],
  stamp: NotificationEnvelope['stamp']
): NotificationEnvelope {
  return {
    userId: 'user-1',
    userEmail: 'user@example.com',
    locale: 'en',
    notification,
    unsubscribeUrl: 'https://app.test/unsubscribe?token=tok-123',
    deepLink: 'https://app.test/people/person-1',
    stamp,
    logMeta: {},
  };
}

describe('renderEmail', () => {
  it('renders an important date reminder addressed to the user from the reminders sender', async () => {
    const item = await renderEmail(
      envelope(
        {
          kind: 'important_date',
          personId: 'person-1',
          personName: 'Ana Torres',
          dateTitle: 'Birthday',
          formattedDate: 'August 26, 2026',
          date: '2026-08-26',
          dateType: 'birthday',
        },
        { model: 'importantDate', id: 'date-1', field: 'lastReminderSent' }
      )
    );

    expect(item.to).toBe('user@example.com');
    expect(item.from).toBe('reminders');
    expect(item.subject).toContain('Ana Torres');
    expect(item.html).toContain('Ana Torres');
    expect(item.html).toContain('https://app.test/unsubscribe?token=tok-123');
  });

  it('renders a lead reminder that mentions the number of days', async () => {
    const item = await renderEmail(
      envelope(
        {
          kind: 'important_date_lead',
          personId: 'person-1',
          personName: 'Ana Torres',
          dateTitle: 'Birthday',
          formattedDate: 'September 2, 2026',
          date: '2026-09-02',
          daysUntil: 7,
        },
        { model: 'importantDate', id: 'date-1', field: 'lastLeadReminderSent' }
      )
    );

    expect(item.subject).toContain('Ana Torres');
    expect(item.html).toContain('7');
  });

  it('renders a contact reminder', async () => {
    const item = await renderEmail(
      envelope(
        {
          kind: 'contact',
          personId: 'person-1',
          personName: 'Ana Torres',
          lastContactFormatted: 'June 1, 2026',
          intervalText: '3 months',
        },
        { model: 'person', id: 'person-1', field: 'lastContactReminderSent' }
      )
    );

    expect(item.to).toBe('user@example.com');
    expect(item.html).toContain('Ana Torres');
  });

  it('renders a weekly digest with one row per event', async () => {
    const item = await renderEmail(
      envelope(
        {
          kind: 'weekly_digest',
          rows: [
            { personName: 'Ana Torres', eventTitle: 'Birthday', formattedDate: 'August 28, 2026', date: '2026-09-01', daysUntil: 2 },
            { personName: 'Bo Lin', eventTitle: 'Anniversary', formattedDate: 'August 30, 2026', date: '2026-09-01', daysUntil: 4 },
          ],
          overflowCount: 3,
        },
        { model: 'user', id: 'user-1', field: 'lastWeeklyDigestSent' }
      )
    );

    expect(item.html).toContain('Ana Torres');
    expect(item.html).toContain('Bo Lin');
  });

  it('renders in the envelope locale rather than always English', async () => {
    const en = await renderEmail(
      envelope(
        {
          kind: 'contact',
          personId: 'person-1',
          personName: 'Ana Torres',
          lastContactFormatted: null,
          intervalText: '3 months',
        },
        { model: 'person', id: 'person-1', field: 'lastContactReminderSent' }
      )
    );

    const es = await renderEmail({
      ...envelope(
        {
          kind: 'contact',
          personId: 'person-1',
          personName: 'Ana Torres',
          lastContactFormatted: null,
          intervalText: '3 meses',
        },
        { model: 'person', id: 'person-1', field: 'lastContactReminderSent' }
      ),
      locale: 'es-ES',
    });

    expect(es.subject).not.toBe(en.subject);
  });
});
