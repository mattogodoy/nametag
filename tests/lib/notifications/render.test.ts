import { describe, it, expect } from 'vitest';
import { renderShortForm } from '../../../lib/notifications/render';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

function envelope(
  notification: NotificationEnvelope['notification'],
  locale: NotificationEnvelope['locale'] = 'en'
): NotificationEnvelope {
  return {
    userId: 'user-1',
    userEmail: 'user@example.com',
    locale,
    notification,
    unsubscribeUrl: 'https://app.test/unsubscribe?token=tok',
    deepLink: 'https://app.test/people/person-1',
    stamp: { model: 'person', id: 'person-1', field: 'lastContactReminderSent' },
    logMeta: {},
  };
}

describe('renderShortForm', () => {
  it('puts the person in the title and the occasion in the body', async () => {
    const result = await renderShortForm(
      envelope({
        kind: 'important_date',
        personId: 'person-1',
        personName: 'Ana Torres',
        dateTitle: 'Birthday',
        formattedDate: 'August 26, 2026',
        dateType: 'birthday',
      })
    );

    expect(result.title).toBe('Ana Torres');
    expect(result.body).toBe('Birthday today');
  });

  it('renders a lead reminder with the date and no day count', async () => {
    const result = await renderShortForm(
      envelope({
        kind: 'important_date_lead',
        personId: 'person-1',
        personName: 'Ana Torres',
        dateTitle: 'Birthday',
        formattedDate: 'September 2, 2026',
        daysUntil: 7,
      })
    );

    expect(result.title).toBe('Ana Torres');
    expect(result.body).toBe('Birthday on September 2, 2026');
  });

  it('renders a contact reminder', async () => {
    const result = await renderShortForm(
      envelope({
        kind: 'contact',
        personId: 'person-1',
        personName: 'Ana Torres',
        lastContactFormatted: null,
        intervalText: '3 months',
      })
    );

    expect(result).toEqual({ title: 'Ana Torres', body: 'Time to catch up' });
  });

  it('renders a digest as a list of up to three events with no count', async () => {
    const result = await renderShortForm(
      envelope({
        kind: 'weekly_digest',
        rows: [
          { personName: 'Ana Torres', eventTitle: 'Birthday', formattedDate: 'Aug 28', daysUntil: 2 },
          { personName: 'Bo Lin', eventTitle: 'Anniversary', formattedDate: 'Aug 30', daysUntil: 4 },
          { personName: 'Cai Wu', eventTitle: 'Name day', formattedDate: 'Aug 31', daysUntil: 5 },
          { personName: 'Dara Okoro', eventTitle: 'Birthday', formattedDate: 'Sep 1', daysUntil: 6 },
        ],
        overflowCount: 0,
      })
    );

    expect(result.title).toBe('Your week ahead');
    expect(result.body).toBe('Ana Torres: Birthday\nBo Lin: Anniversary\nCai Wu: Name day');
    expect(result.body).not.toContain('Dara Okoro');
  });

  it('translates into the envelope locale', async () => {
    const result = await renderShortForm(
      envelope(
        {
          kind: 'contact',
          personId: 'person-1',
          personName: 'Ana Torres',
          lastContactFormatted: null,
          intervalText: '3 meses',
        },
        'es-ES'
      )
    );

    expect(result.body).toBe('Es momento de ponerse al día');
  });

  it('resolves every push string in every locale, with no fallback and no stray placeholder', async () => {
    const locales = [
      'en', 'es-ES', 'de-DE', 'fr-FR', 'it-IT', 'nl-NL', 'nb-NO', 'ru-RU', 'ja-JP', 'zh-CN',
    ] as const;

    // Every key under notifications.push. getTranslationsForLocale returns the
    // bare key when a lookup misses, so a rendered string that equals one of
    // these means that locale is missing it.
    const PUSH_KEYS = ['importantDateBody', 'importantDateLeadBody', 'contactBody', 'digestTitle'];

    const kinds: Array<{ label: string; notification: NotificationEnvelope['notification'] }> = [
      {
        label: 'important_date',
        notification: {
          kind: 'important_date',
          personId: 'person-1',
          personName: 'Ana Torres',
          dateTitle: 'Birthday',
          formattedDate: 'August 26, 2026',
          dateType: 'birthday',
        },
      },
      {
        label: 'important_date_lead',
        notification: {
          kind: 'important_date_lead',
          personId: 'person-1',
          personName: 'Ana Torres',
          dateTitle: 'Birthday',
          formattedDate: 'September 2, 2026',
          daysUntil: 7,
        },
      },
      {
        label: 'contact',
        notification: {
          kind: 'contact',
          personId: 'person-1',
          personName: 'Ana Torres',
          lastContactFormatted: null,
          intervalText: '3 months',
        },
      },
      {
        label: 'weekly_digest',
        notification: {
          kind: 'weekly_digest',
          rows: [
            { personName: 'Ana Torres', eventTitle: 'Birthday', formattedDate: 'Aug 28', daysUntil: 2 },
          ],
          overflowCount: 0,
        },
      },
    ];

    for (const locale of locales) {
      for (const { label, notification } of kinds) {
        const where = `${locale} / ${label}`;
        const result = await renderShortForm(envelope(notification, locale));

        expect(result.title, `${where} title`).toBeTruthy();
        expect(result.body, `${where} body`).toBeTruthy();

        expect(result.title, `${where} title has an unresolved placeholder`).not.toMatch(/\{[a-zA-Z]+\}/);
        expect(result.body, `${where} body has an unresolved placeholder`).not.toMatch(/\{[a-zA-Z]+\}/);

        for (const key of PUSH_KEYS) {
          expect(result.title, `${where} title fell back to the key name`).not.toBe(key);
          expect(result.body, `${where} body fell back to the key name`).not.toBe(key);
        }
      }
    }
  });
});
