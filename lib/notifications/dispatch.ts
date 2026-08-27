import { isEmailConfigured, sendEmailBatch } from '@/lib/email';
import type { SendBatchEmailItem } from '@/lib/email';
import { createModuleLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { renderEmail } from './channels/email';
import { sendNtfy } from './channels/ntfy';
import { sendWebPush } from './channels/web-push';
import { mapWithConcurrency } from './concurrency';
import { MAX_ENDPOINTS_PER_USER, recordEndpointResult } from './endpoint-health';
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
  const endpointsByUser = await loadEndpoints(envelopes);

  // Email first and as one batch, so Resend still receives a single request.
  const emailOutcomes = await dispatchEmail(envelopes, emailEnabled);

  // Per-envelope channels, bounded so a large run does not open one socket per
  // envelope at the same instant.
  const pushOutcomes = await mapWithConcurrency(envelopes, CHANNEL_CONCURRENCY, (envelope) =>
    guard(() => sendWebPush(envelope), 'web_push', envelope.userId)
  );

  const endpointOutcomes = await mapWithConcurrency(envelopes, CHANNEL_CONCURRENCY, (envelope) =>
    guard(
      () => dispatchEndpoints(envelope, endpointsByUser.get(envelope.userId) ?? []),
      'ntfy',
      envelope.userId
    )
  );

  return envelopes.map((_envelope, index) =>
    summarize([emailOutcomes[index], pushOutcomes[index], endpointOutcomes[index]])
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

interface EndpointRecord {
  id: string;
  userId: string;
  type: 'NTFY' | 'WEBHOOK';
  url: string;
  secret: string | null;
}

/**
 * Load every enabled endpoint for the users in this run, grouped by user.
 *
 * One query for the whole run rather than one per envelope: a run holds many
 * envelopes per user and they all share the same endpoint list.
 *
 * `enabled: true` is in the query rather than filtered afterwards so that a
 * disabled or auto-disabled endpoint can never be contacted, even by a future
 * caller that forgets to filter.
 */
async function loadEndpoints(
  envelopes: readonly NotificationEnvelope[]
): Promise<Map<string, EndpointRecord[]>> {
  const userIds = [...new Set(envelopes.map((envelope) => envelope.userId))];

  // Guarded the same way loadEmailPreferences is. An unguarded failure here
  // throws out of dispatchAll and aborts the whole night, silently dropping
  // every day-of, lead, and contact reminder already collected. An empty map
  // means "no endpoints tonight", which costs those users one night of a
  // secondary channel rather than costing everyone their reminders.
  try {
    const endpoints = await prisma.notificationEndpoint.findMany({
      where: { userId: { in: userIds }, enabled: true },
      select: { id: true, userId: true, type: true, url: true, secret: true },
      // Grouped by user below so the per-user slice is deterministic. Without
      // this, an over-cap condition truncates in whatever order Postgres
      // happens to return rows, which can drop an innocent user's entire
      // endpoint list for the night instead of the offending user's excess.
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
      // Belt, not the primary control: the per-user cap is enforced at
      // creation time (MAX_ENDPOINTS_PER_USER). This bounds the query itself
      // so a row created by some path that bypasses that cap cannot make the
      // cron iterate an unbounded list. Multiplied by the number of users in
      // this run because, unlike sendWebPush's per-user query, this one is
      // batched across every user, so a flat take of MAX_ENDPOINTS_PER_USER
      // would silently starve every user after the first few.
      take: MAX_ENDPOINTS_PER_USER * userIds.length,
    });

    // Sliced again here, per user, on top of the query-level take above. The
    // query bound only protects against an unbounded *total* row count; it
    // does not stop one user who is somehow over the cap from consuming
    // another user's share of that combined budget. Dropping this user's
    // excess here, rather than letting it spill into the next user's slice,
    // keeps the truncation scoped to the offending user only.
    const byUser = new Map<string, EndpointRecord[]>();
    for (const endpoint of endpoints) {
      const list = byUser.get(endpoint.userId) ?? [];
      if (list.length >= MAX_ENDPOINTS_PER_USER) {
        continue;
      }
      list.push(endpoint);
      byUser.set(endpoint.userId, list);
    }

    return byUser;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error(
      { errorMessage: message, count: userIds.length },
      'Failed to load notification endpoints, skipping endpoint delivery tonight'
    );
    return new Map();
  }
}

/**
 * Deliver one envelope to every endpoint its owner has configured.
 *
 * Collapsed to a single outcome: delivering to at least one endpoint counts,
 * the same way one live device counts for push. Per-endpoint results are
 * recorded separately for health tracking.
 *
 * The send and the health-tracking write are guarded separately, the same
 * split `sendWebPush` uses (send, then `recordQuietly`). An unguarded throw
 * anywhere in this loop would abandon every endpoint after it for this
 * envelope, not just the one that failed, so each endpoint gets its own
 * try/catch. Keeping the record write in its own catch means a bookkeeping
 * failure (a Prisma blip while writing health) can never be mistaken for, or
 * shadow, a send that actually succeeded. `sendNtfy` already resolves rather
 * than throwing, so guarding it here is belt and braces today and the
 * guarantee this loop needs once a second endpoint type joins it.
 *
 * A throw is also recorded as a failure (coarse code `unknown`), the same as
 * a driver that resolves with an error. Without this, an endpoint whose
 * driver throws every night would never accumulate `consecutiveFailures` and
 * would never auto-disable, unlike one that resolves false. Unreachable today
 * since `sendNtfy` only resolves, but the next endpoint type this loop grows
 * to hold has no such contract yet.
 *
 * `attempted` is tracked separately from `endpoints.length` so a user whose
 * endpoints are all a type not yet handled here (WEBHOOK, before Phase 4
 * exists) reports `skipped` rather than `failed`. Nothing was attempted, so
 * nothing failed.
 */
async function dispatchEndpoints(
  envelope: NotificationEnvelope,
  endpoints: readonly EndpointRecord[]
): Promise<ChannelOutcome> {
  if (endpoints.length === 0) {
    return { channel: 'ntfy', status: 'skipped' };
  }

  let attempted = 0;
  let delivered = 0;
  let lastError = 'Unknown endpoint error';

  for (const endpoint of endpoints) {
    // WEBHOOK is handled in Phase 4. Until then an endpoint of that type
    // cannot be created, so this is unreachable rather than a silent drop.
    if (endpoint.type !== 'NTFY') {
      continue;
    }

    attempted++;

    let result: Awaited<ReturnType<typeof sendNtfy>>;

    try {
      result = await sendNtfy(endpoint, envelope);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown endpoint error';
      lastError = message;
      log.error(
        { ...envelope.logMeta, endpointId: endpoint.id, errorMessage: message },
        "Endpoint delivery threw, continuing with the user's remaining endpoints"
      );

      // Record it too, so a driver that throws every night still accumulates
      // failures and eventually auto-disables, the same as one that resolves
      // with an error. web-push.ts does this for the same reason.
      try {
        await recordEndpointResult(endpoint.id, { ok: false, code: 'unknown' });
      } catch {
        // Bookkeeping only. A failure to record here must not be mistaken
        // for, or reported as, a second delivery failure.
      }

      continue;
    }

    if (result.ok) {
      delivered++;
    } else {
      lastError = result.code;
      log.warn(
        { ...envelope.logMeta, endpointId: endpoint.id, code: result.code },
        'Endpoint delivery failed'
      );
    }

    try {
      await recordEndpointResult(endpoint.id, result);
    } catch (error) {
      log.warn(
        {
          endpointId: endpoint.id,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to record endpoint health'
      );
    }
  }

  if (delivered > 0) {
    return { channel: 'ntfy', status: 'delivered' };
  }

  if (attempted === 0) {
    return { channel: 'ntfy', status: 'skipped' };
  }

  return { channel: 'ntfy', status: 'failed', error: lastError };
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
