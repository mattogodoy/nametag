import type { DigestEmailRow } from '@/lib/email';
import type { SupportedLocale } from '@/lib/i18n-utils';

/**
 * What happened, stated without reference to how it will be delivered.
 *
 * Every field here is already formatted for display (dates rendered in the
 * user's date format, names run through formatGraphName) because the cron is
 * the only place with the context to do that correctly. Channels choose
 * wording and layout, not data.
 */
export type ReminderNotification =
  | {
      kind: 'important_date';
      personId: string;
      personName: string;
      dateTitle: string;
      formattedDate: string;
      /** Predefined key ("birthday", "anniversary", "nameday", "memorial") or null for custom dates. */
      dateType: string | null;
    }
  | {
      kind: 'important_date_lead';
      personId: string;
      personName: string;
      dateTitle: string;
      formattedDate: string;
      daysUntil: number;
    }
  | {
      kind: 'contact';
      personId: string;
      personName: string;
      lastContactFormatted: string | null;
      intervalText: string;
    }
  | {
      kind: 'weekly_digest';
      rows: DigestEmailRow[];
      overflowCount: number;
    };

/**
 * Which row and column record that this notification was sent.
 *
 * A discriminated union rather than a flat {model, field} record, so that an
 * impossible pair such as {model: 'person', field: 'lastWeeklyDigestSent'}
 * cannot be constructed, and so the field can be handed to Prisma without a
 * cast.
 */
export type StampTarget =
  | { model: 'importantDate'; id: string; field: 'lastReminderSent' | 'lastLeadReminderSent' }
  | { model: 'person'; id: string; field: 'lastContactReminderSent' }
  | { model: 'user'; id: string; field: 'lastWeeklyDigestSent' };

export interface NotificationEnvelope {
  userId: string;
  userEmail: string;
  locale: SupportedLocale;
  notification: ReminderNotification;
  /** Absolute one-click unsubscribe URL. Email-only, but computed once per envelope. */
  unsubscribeUrl: string;
  /** Absolute deep link, /people/<id> or /dashboard. */
  deepLink: string;
  stamp: StampTarget;
  /** Structured fields for the cron's log lines. */
  logMeta: Record<string, string>;
}

/**
 * Which channel produced a {@link ChannelOutcome}.
 *
 * A string union rather than a free-form string, so a new channel (ntfy,
 * webhooks) is a compile error everywhere this is matched exhaustively,
 * rather than a silently unlabelled log line.
 */
export type ChannelId = 'email' | 'web_push';

/**
 * Outcome of one channel attempting one envelope.
 *
 * `skipped` means there was nothing to deliver to (no email provider
 * configured, no push subscriptions, no endpoints), which is different from
 * a delivery that was attempted and failed. Only the latter is an error.
 *
 * Carries which channel produced it, so a partial-success log line can name
 * the channels that failed instead of only counting them.
 */
export type ChannelOutcome =
  | { channel: ChannelId; status: 'delivered' }
  | { channel: ChannelId; status: 'failed'; error: string }
  | { channel: ChannelId; status: 'skipped' };

export interface DispatchResult {
  delivered: number;
  failed: number;
  skipped: number;
  /**
   * True when at least one channel delivered.
   *
   * Drives whether the cron writes the "sent" timestamp. False must mean
   * nothing was delivered anywhere, because stamping an undelivered
   * notification burns it permanently: the day-of reminder is marked sent for
   * that occurrence, the digest for that week, and the lead reminder for its
   * whole lead window.
   */
  shouldStamp: boolean;
  /**
   * Message from the first channel outcome that failed, in outcome order
   * (email before push). Undefined when nothing failed.
   *
   * Lets the cron's "Failed to send reminder" log line carry a reason again,
   * instead of forcing an operator to correlate it with a separate
   * per-channel log line by timestamp.
   */
  firstError?: string;
  /**
   * Which channels failed, in outcome order. Undefined when nothing failed.
   *
   * Replaces logging `failedChannels` as a bare count, which reads like a
   * list of names but is not one, and stops answering "which ones" the
   * moment a third channel exists.
   */
  failedChannels?: ChannelId[];
}
