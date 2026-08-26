import { isEmailConfigured, sendEmailBatch } from '@/lib/email';
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

  const items = await Promise.all(envelopes.map((envelope) => renderEmail(envelope)));

  try {
    const batch = await sendEmailBatch(items);

    return envelopes.map((_envelope, index) => {
      const result = batch.results[index];

      if (!result) {
        return { status: 'failed', error: 'No result returned for this message' };
      }

      // `skipped` means the provider never attempted delivery. Treating it as
      // success would stamp a reminder that nobody received, and the stamp is
      // not recoverable once email is configured later.
      if (result.skipped) {
        return { status: 'skipped' };
      }

      return result.success
        ? { status: 'delivered' }
        : { status: 'failed', error: result.error ?? 'Unknown email error' };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log.error({ errorMessage: message, count: envelopes.length }, 'Email batch send threw');
    return envelopes.map(() => ({ status: 'failed', error: message }));
  }
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
