import { decryptSecret } from '@/lib/crypto/secrets';
import { getVersion } from '@/lib/version';
import { postJson, type OutboundResult } from '../outbound';
import { renderShortForm } from '../render';
import { signPayload } from '../signature';
import type { NotificationEnvelope, ReminderNotification } from '../types';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string | null;
}

/**
 * The machine-readable part of the payload.
 *
 * Deliberately does NOT include the unsubscribe URL. That token is a bearer
 * credential for turning a reminder off by email, and this payload is leaving
 * for a third-party server the user chose but we do not trust.
 */
function payloadData(notification: ReminderNotification): Record<string, unknown> {
  switch (notification.kind) {
    case 'important_date':
      return {
        personId: notification.personId,
        personName: notification.personName,
        dateTitle: notification.dateTitle,
        dateType: notification.dateType,
        formattedDate: notification.formattedDate,
        // Raw ISO calendar date (YYYY-MM-DD), alongside the display-formatted
        // one. A receiver parsing formattedDate would have to guess whether
        // "26 de agosto de 2026" is day-month-year or month-day-year; this
        // field removes the guess. Comes straight from the envelope, which
        // Task 3's change to app/api/cron/send-reminders/route.ts populates.
        date: notification.date,
      };
    case 'important_date_lead':
      return {
        personId: notification.personId,
        personName: notification.personName,
        dateTitle: notification.dateTitle,
        formattedDate: notification.formattedDate,
        date: notification.date,
        daysUntil: notification.daysUntil,
      };
    case 'contact':
      return {
        personId: notification.personId,
        personName: notification.personName,
        lastContact: notification.lastContactFormatted,
        interval: notification.intervalText,
      };
    case 'weekly_digest':
      return {
        events: notification.rows.map((row) => ({
          personName: row.personName,
          eventTitle: row.eventTitle,
          formattedDate: row.formattedDate,
          daysUntil: row.daysUntil,
        })),
        overflowCount: notification.overflowCount,
      };
  }
}

/**
 * Deliver one notification to one webhook endpoint.
 *
 * Header discipline is the security property here. The set below is fixed and
 * closed: no value from the user, the person record, or the endpoint config
 * ever becomes a header name or a header value. Everything variable travels
 * inside the JSON body, where it is escaped by JSON.stringify and covered by
 * the signature.
 */
export async function sendWebhook(
  endpoint: WebhookEndpoint,
  envelope: NotificationEnvelope,
  now: Date = new Date()
): Promise<OutboundResult> {
  // An endpoint without a secret cannot be signed, and sending unsigned would
  // give the receiver no way to tell our request from anyone else's. Every
  // webhook gets a secret at creation, so this is a corrupt row rather than a
  // supported configuration.
  if (!endpoint.secret) {
    return { ok: false, code: 'blocked' };
  }

  const { title, body } = await renderShortForm(envelope);
  const event = `reminder.${envelope.notification.kind}`;

  const payload = JSON.stringify({
    event,
    occurredAt: now.toISOString(),
    title,
    body,
    url: envelope.deepLink,
    data: payloadData(envelope.notification),
  });

  const timestamp = Math.floor(now.getTime() / 1000).toString();
  const signature = signPayload(decryptSecret(endpoint.secret), timestamp, payload);

  return postJson(endpoint.url, payload, {
    'User-Agent': `Nametag/${getVersion()} (+https://nametag.one)`,
    'X-Nametag-Event': event,
    'X-Nametag-Timestamp': timestamp,
    'X-Nametag-Signature': signature,
  });
}
