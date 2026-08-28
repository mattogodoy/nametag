import { getTranslationsForLocale } from '@/lib/i18n-utils';
import type { NotificationEnvelope } from './types';

export interface ShortForm {
  title: string;
  body: string;
}

/** How many digest rows fit in a notification before it stops being scannable. */
const DIGEST_PREVIEW_ROWS = 3;

/**
 * Render a notification for channels with a title and a short body: push,
 * ntfy, and webhooks.
 *
 * The person is the title and the occasion is the body, because a phone
 * notification is read name-first and the app is organised around people
 * rather than events.
 *
 * No string here interpolates a count. getTranslationsForLocale is a plain
 * {word} replacer with no ICU support, so a plural form would reach the user
 * as literal ICU syntax. Where a count would be natural, the formatted date or
 * a truncated list is used instead.
 */
export async function renderShortForm(envelope: NotificationEnvelope): Promise<ShortForm> {
  const t = await getTranslationsForLocale(envelope.locale, 'notifications.push');
  const { notification } = envelope;

  switch (notification.kind) {
    case 'important_date':
      return {
        title: notification.personName,
        body: t('importantDateBody', { dateTitle: notification.dateTitle }),
      };

    case 'important_date_lead':
      return {
        title: notification.personName,
        body: t('importantDateLeadBody', {
          dateTitle: notification.dateTitle,
          formattedDate: notification.formattedDate,
        }),
      };

    case 'contact':
      return {
        title: notification.personName,
        body: t('contactBody'),
      };

    case 'weekly_digest':
      return {
        title: t('digestTitle'),
        body: notification.rows
          .slice(0, DIGEST_PREVIEW_ROWS)
          .map((row) => `${row.personName}: ${row.eventTitle}`)
          .join('\n'),
      };
  }
}
