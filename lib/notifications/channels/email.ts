import { emailTemplates } from '@/lib/email';
import type { SendBatchEmailItem } from '@/lib/email';
import type { NotificationEnvelope } from '../types';

/**
 * Turn an envelope into an email message.
 *
 * This is the only place email rendering happens. The templates themselves are
 * untouched: this function exists to map the channel-agnostic envelope onto
 * the argument list each template already expects, so that adding a channel
 * never means editing a template.
 */
export async function renderEmail(envelope: NotificationEnvelope): Promise<SendBatchEmailItem> {
  const { notification, locale, unsubscribeUrl, userEmail } = envelope;

  switch (notification.kind) {
    case 'important_date': {
      const template = await emailTemplates.importantDateReminder(
        notification.personName,
        notification.dateTitle,
        notification.formattedDate,
        unsubscribeUrl,
        locale
      );
      return { to: userEmail, subject: template.subject, html: template.html, text: template.text, from: 'reminders' };
    }

    case 'important_date_lead': {
      const template = await emailTemplates.importantDateLeadReminder(
        notification.personName,
        notification.dateTitle,
        notification.formattedDate,
        notification.daysUntil,
        unsubscribeUrl,
        locale
      );
      return { to: userEmail, subject: template.subject, html: template.html, text: template.text, from: 'reminders' };
    }

    case 'contact': {
      const template = await emailTemplates.contactReminder(
        notification.personName,
        notification.lastContactFormatted,
        notification.intervalText,
        unsubscribeUrl,
        locale
      );
      return { to: userEmail, subject: template.subject, html: template.html, text: template.text, from: 'reminders' };
    }

    case 'weekly_digest': {
      const template = await emailTemplates.weeklyDigest(
        notification.rows,
        notification.overflowCount,
        unsubscribeUrl,
        locale
      );
      return { to: userEmail, subject: template.subject, html: template.html, text: template.text, from: 'reminders' };
    }
  }
}
