import { isEmailConfigured, sendEmailBatch } from '@/lib/email';
import type { SendBatchEmailItem } from '@/lib/email';
import { createModuleLogger } from '@/lib/logger';
import { renderEmail } from './channels/email';
import type { ChannelOutcome, DispatchResult, NotificationEnvelope } from './types';

const log = createModuleLogger('notifications');

/**
 * Deliver a batch of envelopes across every channel the recipient has enabled.
 *
 * Email is handled as one batch rather than per envelope. Resend's batch
 * endpoint is a single HTTP call for up to 100 messages, and dispatching
 * envelope by envelope would turn one request into hundreds. Channels added in
 * later phases are per envelope and run through mapWithConcurrency instead.
 */
export async function dispatchAll(
  envelopes: readonly NotificationEnvelope[]
): Promise<DispatchResult[]> {
  if (envelopes.length === 0) {
    return [];
  }

  const emailOutcomes = await dispatchEmail(envelopes);

  return envelopes.map((_envelope, index) => summarize([emailOutcomes[index]]));
}

/**
 * Render and send every envelope's email in one batch.
 *
 * Returns one outcome per envelope, positionally aligned with the input.
 */
async function dispatchEmail(
  envelopes: readonly NotificationEnvelope[]
): Promise<ChannelOutcome[]> {
  if (!isEmailConfigured()) {
    return envelopes.map(() => ({ status: 'skipped' }));
  }

  const outcomes: ChannelOutcome[] = envelopes.map(() => ({ status: 'skipped' }));

  // Rendered per envelope rather than as one all-or-nothing batch. A locale or
  // template failure on a single reminder must not stop every other user's
  // reminder from going out that night.
  const rendered = await Promise.allSettled(envelopes.map((envelope) => renderEmail(envelope)));

  // Only successfully rendered envelopes go in the batch, so batch positions no
  // longer line up with envelope positions and have to be mapped back.
  const indexes: number[] = [];
  const items: SendBatchEmailItem[] = [];

  rendered.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      indexes.push(index);
      items.push(result.value);
      return;
    }

    const message = result.reason instanceof Error ? result.reason.message : 'Unknown render error';
    log.error(
      { errorMessage: message, kind: envelopes[index].notification.kind },
      'Failed to render reminder email'
    );
    outcomes[index] = { status: 'failed', error: message };
  });

  if (items.length === 0) {
    return outcomes;
  }

  try {
    const batch = await sendEmailBatch(items);

    indexes.forEach((envelopeIndex, batchIndex) => {
      const result = batch.results[batchIndex];

      if (!result) {
        outcomes[envelopeIndex] = { status: 'failed', error: 'No result returned for this message' };
        return;
      }

      // `skipped` means the provider never attempted delivery. Treating it as
      // success would stamp a reminder nobody received, and the stamp is not
      // recoverable once email is configured later.
      if (result.skipped) {
        outcomes[envelopeIndex] = { status: 'skipped' };
        return;
      }

      outcomes[envelopeIndex] = result.success
        ? { status: 'delivered' }
        : { status: 'failed', error: result.error ?? 'Unknown email error' };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ errorMessage: message, count: items.length }, 'Email batch send threw');
    indexes.forEach((envelopeIndex) => {
      outcomes[envelopeIndex] = { status: 'failed', error: message };
    });
  }

  return outcomes;
}

function summarize(outcomes: readonly ChannelOutcome[]): DispatchResult {
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const outcome of outcomes) {
    if (outcome.status === 'delivered') delivered++;
    else if (outcome.status === 'failed') failed++;
    else skipped++;
  }

  return { delivered, failed, skipped, shouldStamp: delivered > 0 };
}
