import { isEmailConfigured, sendEmailBatch } from '@/lib/email';
import type { SendBatchEmailItem } from '@/lib/email';
import { createModuleLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { renderEmail } from './channels/email';
import { sendWebPush } from './channels/web-push';
import { mapWithConcurrency } from './concurrency';
import type { ChannelId, ChannelOutcome, DispatchResult, NotificationEnvelope } from './types';

const log = createModuleLogger('notifications');

/** Ceiling on simultaneous per-envelope channel sends. */
const CHANNEL_CONCURRENCY = 10;

/**
 * Deliver a batch of envelopes across every channel the recipient has enabled.
 *
 * Email is handled as one batch rather than per envelope. Resend's batch
 * endpoint is a single HTTP call for up to 100 messages, and dispatching
 * envelope by envelope would turn one request into hundreds. Web push, and
 * channels still to come (ntfy, webhooks), deliver per envelope instead, with
 * their own concurrency limit so one slow user does not stall the whole run.
 */
export async function dispatchAll(
  envelopes: readonly NotificationEnvelope[]
): Promise<DispatchResult[]> {
  if (envelopes.length === 0) {
    return [];
  }

  const emailEnabled = await loadEmailPreferences(envelopes);

  // Email first and as one batch, so Resend still receives a single request.
  const emailOutcomes = await dispatchEmail(envelopes, emailEnabled);

  // Per-envelope channels, bounded so a large run does not open one socket per
  // envelope at the same instant.
  const pushOutcomes = await mapWithConcurrency(envelopes, CHANNEL_CONCURRENCY, (envelope) =>
    guard(() => sendWebPush(envelope), 'web_push', envelope.userId)
  );

  return envelopes.map((_envelope, index) =>
    summarize([emailOutcomes[index], pushOutcomes[index]])
  );
}

/**
 * Read emailRemindersEnabled once per distinct user.
 *
 * A run holds many envelopes per user, so this is one query rather than one
 * per envelope. A user missing from the result defaults to enabled, matching
 * the column default.
 */
async function loadEmailPreferences(
  envelopes: readonly NotificationEnvelope[]
): Promise<Map<string, boolean>> {
  const userIds = [...new Set(envelopes.map((envelope) => envelope.userId))];

  // Guarded like every other query in this file: a lookup failure here must
  // not take down the whole run and silently drop every already-collected
  // day-of, lead, and contact reminder for the night. An empty map defaults
  // every user to enabled, the same safe default as a user missing from the
  // result.
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, emailRemindersEnabled: true },
    });

    return new Map(users.map((user) => [user.id, user.emailRemindersEnabled]));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(
      { errorMessage: message, count: userIds.length },
      'Failed to load email preferences, defaulting every user to enabled'
    );
    return new Map();
  }
}

/**
 * Render and send every envelope's email in one batch.
 *
 * Returns one outcome per envelope, positionally aligned with the input.
 */
async function dispatchEmail(
  envelopes: readonly NotificationEnvelope[],
  emailEnabled: Map<string, boolean>
): Promise<ChannelOutcome[]> {
  const eligible = envelopes.map((envelope) => emailEnabled.get(envelope.userId) !== false);

  const outcomes: ChannelOutcome[] = envelopes.map(() => ({ channel: 'email', status: 'skipped' }));

  if (!isEmailConfigured() || !eligible.some(Boolean)) {
    return outcomes;
  }

  // Rendered per envelope rather than as one all-or-nothing batch. A locale or
  // template failure on a single reminder must not stop every other user's
  // reminder from going out that night.
  const eligibleIndexes = envelopes
    .map((_envelope, index) => index)
    .filter((index) => eligible[index]);

  const rendered = await Promise.allSettled(
    eligibleIndexes.map((index) => renderEmail(envelopes[index]))
  );

  // Only successfully rendered envelopes go in the batch, so batch positions no
  // longer line up with envelope positions and have to be mapped back.
  const indexes: number[] = [];
  const items: SendBatchEmailItem[] = [];

  rendered.forEach((result, position) => {
    const envelopeIndex = eligibleIndexes[position];

    if (result.status === 'fulfilled') {
      indexes.push(envelopeIndex);
      items.push(result.value);
      return;
    }

    const message =
      result.reason instanceof Error ? result.reason.message : 'Unknown render error';
    log.error(
      {
        ...envelopes[envelopeIndex].logMeta,
        errorMessage: message,
        kind: envelopes[envelopeIndex].notification.kind,
      },
      'Failed to render reminder email'
    );
    outcomes[envelopeIndex] = { channel: 'email', status: 'failed', error: message };
  });

  if (items.length === 0) {
    return outcomes;
  }

  try {
    const batch = await sendEmailBatch(items);

    indexes.forEach((envelopeIndex, batchIndex) => {
      const result = batch.results[batchIndex];

      if (!result) {
        outcomes[envelopeIndex] = {
          channel: 'email',
          status: 'failed',
          error: 'No result returned for this message',
        };
        return;
      }

      // `skipped` means the provider never attempted delivery. Treating it as
      // success would stamp a reminder nobody received, and the stamp is not
      // recoverable once email is configured later.
      if (result.skipped) {
        outcomes[envelopeIndex] = { channel: 'email', status: 'skipped' };
        return;
      }

      if (result.success) {
        outcomes[envelopeIndex] = { channel: 'email', status: 'delivered' };
        return;
      }

      const error = result.error ?? 'Unknown email error';
      log.error(
        { ...envelopes[envelopeIndex].logMeta, errorMessage: error, kind: envelopes[envelopeIndex].notification.kind },
        'Email delivery failed for one reminder'
      );
      outcomes[envelopeIndex] = { channel: 'email', status: 'failed', error };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ errorMessage: message, count: items.length }, 'Email batch send threw');
    indexes.forEach((envelopeIndex) => {
      outcomes[envelopeIndex] = { channel: 'email', status: 'failed', error: message };
    });
  }

  return outcomes;
}

/**
 * Run a channel driver so that a thrown error costs that channel, not the run.
 *
 * The cron delivers every user's reminders in one pass. One driver throwing on
 * one envelope must not abort the pass and leave later users unnotified.
 */
async function guard(
  send: () => Promise<ChannelOutcome>,
  channel: ChannelId,
  userId: string
): Promise<ChannelOutcome> {
  try {
    return await send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ channel, userId, errorMessage: message }, 'Channel driver threw');
    return { channel, status: 'failed', error: message };
  }
}

function summarize(outcomes: readonly ChannelOutcome[]): DispatchResult {
  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  let firstError: string | undefined;
  let failedChannels: ChannelId[] | undefined;

  for (const outcome of outcomes) {
    switch (outcome.status) {
      case 'delivered':
        delivered++;
        break;
      case 'failed':
        failed++;
        if (firstError === undefined) {
          firstError = outcome.error;
        }
        (failedChannels ??= []).push(outcome.channel);
        break;
      case 'skipped':
        skipped++;
        break;
      default: {
        const unhandled: never = outcome;
        throw new Error(`Unhandled channel outcome: ${JSON.stringify(unhandled)}`);
      }
    }
  }

  return { delivered, failed, skipped, shouldStamp: delivered > 0, firstError, failedChannels };
}
