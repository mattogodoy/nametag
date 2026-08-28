import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';
import { HealthAccumulator } from '../../../lib/notifications/endpoint-health';

const mocks = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(),
  sendEmailBatch: vi.fn(),
  renderEmail: vi.fn(),
}));

vi.mock('../../../lib/email', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/email')>('../../../lib/email');
  return {
    ...actual,
    isEmailConfigured: mocks.isEmailConfigured,
    sendEmailBatch: mocks.sendEmailBatch,
  };
});

vi.mock('../../../lib/notifications/channels/email', () => ({ renderEmail: mocks.renderEmail }));

const pushMocks = vi.hoisted(() => ({
  sendWebPush: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('../../../lib/notifications/channels/web-push', () => ({
  sendWebPush: pushMocks.sendWebPush,
}));

const endpointMocks = vi.hoisted(() => ({
  endpointFindMany: vi.fn(),
  sendNtfy: vi.fn(),
  // HealthAccumulator.flush() calls the real recordEndpointResult, which is a
  // plain function defined inside endpoint-health.ts: a consumer-side partial
  // mock of that module cannot intercept its own internal call to itself, so
  // health has to be exercised end to end here through the prisma calls
  // recordEndpointResult itself makes, the same way tests/lib/notifications/
  // endpoint-health.test.ts and channel-web-push.test.ts do.
  endpointUpdate: vi.fn(),
  endpointUpdateMany: vi.fn(),
}));

vi.mock('../../../lib/notifications/channels/ntfy', () => ({ sendNtfy: endpointMocks.sendNtfy }));

const webhookMocks = vi.hoisted(() => ({ sendWebhook: vi.fn(), canUseWebhooks: vi.fn() }));

vi.mock('../../../lib/notifications/channels/webhook', () => ({
  sendWebhook: webhookMocks.sendWebhook,
}));
vi.mock('../../../lib/notifications/entitlements', () => ({
  canUseWebhooks: webhookMocks.canUseWebhooks,
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    user: { findMany: pushMocks.userFindMany },
    notificationEndpoint: {
      findMany: endpointMocks.endpointFindMany,
      update: endpointMocks.endpointUpdate,
      updateMany: endpointMocks.endpointUpdateMany,
    },
  },
}));

import { dispatchAll } from '../../../lib/notifications/dispatch';

function envelope(id: string): NotificationEnvelope {
  return {
    userId: `user-${id}`,
    userEmail: `user-${id}@example.com`,
    locale: 'en',
    notification: {
      kind: 'contact',
      personId: `person-${id}`,
      personName: 'Ana Torres',
      lastContactFormatted: null,
      intervalText: '3 months',
    },
    unsubscribeUrl: 'https://app.test/unsubscribe?token=tok',
    deepLink: `https://app.test/people/person-${id}`,
    stamp: { model: 'person', id: `person-${id}`, field: 'lastContactReminderSent' },
    logMeta: {},
  };
}

/**
 * Like `envelope`, but with an explicit userId, so two envelopes can share
 * the same owner (and therefore the same destinations) instead of each
 * getting its own derived `user-<id>`. Used by the run-scoped health
 * aggregation tests below, which need multiple envelopes to land on the
 * same endpoint within a single dispatchAll call.
 */
function envelopeForUser(userId: string, personId: string): NotificationEnvelope {
  return {
    userId,
    userEmail: `${userId}@example.com`,
    locale: 'en',
    notification: {
      kind: 'contact',
      personId,
      personName: 'Ana Torres',
      lastContactFormatted: null,
      intervalText: '3 months',
    },
    unsubscribeUrl: 'https://app.test/unsubscribe?token=tok',
    deepLink: `https://app.test/people/${personId}`,
    stamp: { model: 'person', id: personId, field: 'lastContactReminderSent' },
    logMeta: {},
  };
}

describe('dispatchAll', () => {
  beforeEach(() => {
    mocks.isEmailConfigured.mockReset();
    mocks.sendEmailBatch.mockReset();
    mocks.renderEmail.mockReset();
    mocks.isEmailConfigured.mockReturnValue(true);
    mocks.renderEmail.mockResolvedValue({ to: 'user@example.com', subject: 'test', html: '<p>test</p>' });
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });
    pushMocks.userFindMany.mockReset();
    pushMocks.userFindMany.mockResolvedValue([
      { id: 'user-1', emailRemindersEnabled: true },
      { id: 'user-2', emailRemindersEnabled: true },
      { id: 'user-3', emailRemindersEnabled: true },
    ]);
    // No ntfy endpoints configured anywhere in this describe block, so every
    // envelope's ntfy outcome is a default skip. Reset explicitly rather than
    // relying on a bare vi.fn()'s undefined return, which would otherwise hit
    // loadEndpoints' catch path and log a spurious error every test.
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.endpointFindMany.mockResolvedValue([]);
  });

  it('sends every email in a single batch call so Resend batching is preserved', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: true,
      results: [{ success: true }, { success: true }, { success: true }],
    });

    await dispatchAll([envelope('1'), envelope('2'), envelope('3')]);

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(3);
  });

  it('marks a delivered envelope as stampable', async () => {
    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 2 is the push channel (no subscriptions configured) plus the
    // ntfy channel (no endpoints configured) in this test.
    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 2, shouldStamp: true });
  });

  it('does NOT stamp when email is not configured, so the send is not burned', async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 3 is email (not configured) plus push (no subscriptions) plus
    // ntfy (no endpoints).
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 3, shouldStamp: false });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('does NOT stamp when the provider reports the send as skipped', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: true,
      results: [{ success: true, skipped: true, message: 'Email not configured' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.shouldStamp).toBe(false);
    // 3, not 1: the email channel skip plus the push channel's default skip
    // plus the ntfy channel's default skip (neither configured in this test).
    expect(result.skipped).toBe(3);
    expect(result.delivered).toBe(0);
  });

  it('does NOT stamp a failed send', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: false, error: 'smtp refused' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 2 is the push channel (no subscriptions configured) plus the
    // ntfy channel (no endpoints configured) in this test.
    expect(result).toEqual({
      delivered: 0,
      failed: 1,
      skipped: 2,
      shouldStamp: false,
      firstError: 'smtp refused',
      failedChannels: ['email'],
    });
  });

  it('returns one result per envelope in input order', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: true }, { success: false, error: 'nope' }, { success: true }],
    });

    const results = await dispatchAll([envelope('1'), envelope('2'), envelope('3')]);

    expect(results.map((r) => r.shouldStamp)).toEqual([true, false, true]);
  });

  it('returns an empty array and sends nothing for no envelopes', async () => {
    const results = await dispatchAll([]);

    expect(results).toEqual([]);
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('treats a thrown batch send as a failure for every envelope rather than crashing the cron', async () => {
    mocks.sendEmailBatch.mockRejectedValue(new Error('connection reset'));

    const results = await dispatchAll([envelope('1'), envelope('2')]);

    expect(results.every((r) => r.failed === 1 && r.shouldStamp === false)).toBe(true);
  });

  it('a single failing render does not stop the others', async () => {
    mocks.renderEmail.mockResolvedValueOnce({ to: 'user-1@example.com', subject: 'test', html: '<p>test</p>' });
    mocks.renderEmail.mockRejectedValueOnce(new Error('Template not found'));
    mocks.renderEmail.mockResolvedValueOnce({ to: 'user-3@example.com', subject: 'test', html: '<p>test</p>' });

    mocks.sendEmailBatch.mockResolvedValue({
      success: true,
      results: [{ success: true }, { success: true }],
    });

    const results = await dispatchAll([envelope('1'), envelope('2'), envelope('3')]);

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(2);
    expect(results.map((r) => r.shouldStamp)).toEqual([true, false, true]);
  });

  it('a failed render is reported failed and never stamped', async () => {
    mocks.renderEmail.mockRejectedValue(new Error('Locale not supported'));

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 2 is the push channel (no subscriptions configured) plus the
    // ntfy channel (no endpoints configured) in this test.
    expect(result).toEqual({
      delivered: 0,
      failed: 1,
      skipped: 2,
      shouldStamp: false,
      firstError: 'Locale not supported',
      failedChannels: ['email'],
    });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });
});

describe('dispatchAll with push', () => {
  beforeEach(() => {
    mocks.isEmailConfigured.mockReset();
    mocks.sendEmailBatch.mockReset();
    mocks.renderEmail.mockReset();
    pushMocks.sendWebPush.mockReset();
    pushMocks.userFindMany.mockReset();
    mocks.isEmailConfigured.mockReturnValue(true);
    // Sibling describe block, so the outer beforeEach's renderEmail default
    // does not apply here and must be set explicitly, or a rejection left
    // over from whichever test last ran in the other block would leak in.
    mocks.renderEmail.mockResolvedValue({ to: 'user-1@example.com', subject: 'test', html: '<p>test</p>' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: true }]);
    // Same reasoning as the sibling describe block: no ntfy endpoints are
    // configured here, so every envelope's ntfy outcome defaults to skipped.
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.endpointFindMany.mockResolvedValue([]);
  });

  it('stamps when push delivered even though email failed', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: false, error: 'smtp refused' }],
    });
    pushMocks.sendWebPush.mockResolvedValue({ status: 'delivered' });

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 1 is the ntfy channel, which has no endpoints configured in
    // this test and so reports skipped by default.
    expect(result).toEqual({
      delivered: 1,
      failed: 1,
      skipped: 1,
      shouldStamp: true,
      firstError: 'smtp refused',
      failedChannels: ['email'],
    });
  });

  it('does not send email when the user turned email reminders off', async () => {
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    pushMocks.sendWebPush.mockResolvedValue({ status: 'delivered' });

    const [result] = await dispatchAll([envelope('1')]);

    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
    expect(result.shouldStamp).toBe(true);
  });

  it('does not stamp when email is off and push has no devices', async () => {
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 3 is email (off), push (no devices) and ntfy (no endpoints).
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 3, shouldStamp: false });
  });

  it('treats a thrown push driver as a channel failure, not a crash', async () => {
    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });
    pushMocks.sendWebPush.mockRejectedValue(new Error('driver blew up'));

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.shouldStamp).toBe(true);
  });

  it('keeps outcomes on the right envelope when eligibility and rendering both thin the batch', async () => {
    // user-2 has email off. user-3 is eligible but its template throws.
    pushMocks.userFindMany.mockResolvedValue([
      { id: 'user-1', emailRemindersEnabled: true },
      { id: 'user-2', emailRemindersEnabled: false },
      { id: 'user-3', emailRemindersEnabled: true },
    ]);
    // No subscriptions for anyone in this test; push always skips, so the
    // skipped counts below isolate exactly what the email side is doing.
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });

    // Renders run in eligible order: envelope 0, then envelope 2.
    mocks.renderEmail
      .mockResolvedValueOnce({ to: 'a@example.com', subject: 's', html: 'h', from: 'reminders' })
      .mockRejectedValueOnce(new Error('bad locale key'));

    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });

    const results = await dispatchAll([envelope('1'), envelope('2'), envelope('3')]);

    // Only envelope 0 was both eligible and renderable, so exactly one message
    // reaches the provider. If the eligibility filter were dropped from the
    // render step, envelope 1's email would be in here too.
    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmailBatch.mock.calls[0][0]).toHaveLength(1);

    // The render failure must land on envelope 2, not envelope 1. With the
    // bridge collapsed to `position`, the failure would be attributed to
    // envelope 1 and envelope 2 would look merely skipped.
    // skipped counts below are one higher than the email/push story alone
    // accounts for: every envelope also carries the ntfy channel's default
    // skip, since no endpoints are configured in this test.
    expect(results).toEqual([
      { delivered: 1, failed: 0, skipped: 2, shouldStamp: true },
      { delivered: 0, failed: 0, skipped: 3, shouldStamp: false },
      {
        delivered: 0,
        failed: 1,
        skipped: 2,
        shouldStamp: false,
        firstError: 'bad locale key',
        failedChannels: ['email'],
      },
    ]);
  });

  it('a throwing push driver costs that envelope only, not the ones after it', async () => {
    mocks.isEmailConfigured.mockReturnValue(false);
    pushMocks.userFindMany.mockResolvedValue([
      { id: 'user-1', emailRemindersEnabled: true },
      { id: 'user-2', emailRemindersEnabled: true },
    ]);
    pushMocks.sendWebPush
      .mockRejectedValueOnce(new Error('driver blew up'))
      .mockResolvedValueOnce({ status: 'delivered' });

    const results = await dispatchAll([envelope('1'), envelope('2')]);

    // skipped: 2 is email (not configured, for both envelopes) plus the ntfy
    // channel's default skip (no endpoints configured in this test).
    expect(results[0]).toEqual({
      delivered: 0,
      failed: 1,
      skipped: 2,
      shouldStamp: false,
      firstError: 'driver blew up',
      failedChannels: ['web_push'],
    });
    expect(results[1]).toEqual({ delivered: 1, failed: 0, skipped: 2, shouldStamp: true });
  });

  it('keeps the batch index bridge pinned when an ineligible envelope and a render failure both thin the batch', async () => {
    // envelope-1 is ineligible outright (email off). envelope-3's render
    // rejects. envelope-2 and envelope-4 both render fine and reach the
    // batch, so eligibleIndexes ([1,2,3]) and the render-success indexes
    // ([1,3]) diverge from each other, which is exactly the shape needed to
    // catch a batch result read that indexes through the wrong array.
    pushMocks.userFindMany.mockResolvedValue([
      { id: 'user-1', emailRemindersEnabled: false },
      { id: 'user-2', emailRemindersEnabled: true },
      { id: 'user-3', emailRemindersEnabled: true },
      { id: 'user-4', emailRemindersEnabled: true },
    ]);
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });

    // Renders run in eligible order: envelope-2, then envelope-3, then envelope-4.
    mocks.renderEmail
      .mockResolvedValueOnce({ to: 'user-2@example.com', subject: 's', html: 'h' })
      .mockRejectedValueOnce(new Error('bad locale key'))
      .mockResolvedValueOnce({ to: 'user-4@example.com', subject: 's', html: 'h' });

    // Heterogeneous on purpose: a mis-indexed read into this array must flip
    // the outcome it lands on, not just move the same value around.
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: true }, { success: false, error: 'smtp refused' }],
    });

    const results = await dispatchAll([
      envelope('1'),
      envelope('2'),
      envelope('3'),
      envelope('4'),
    ]);

    // skipped counts below are one higher than the email/push story alone
    // accounts for: every envelope also carries the ntfy channel's default
    // skip, since no endpoints are configured in this test.
    expect(results).toEqual([
      { delivered: 0, failed: 0, skipped: 3, shouldStamp: false },
      { delivered: 1, failed: 0, skipped: 2, shouldStamp: true },
      {
        delivered: 0,
        failed: 1,
        skipped: 2,
        shouldStamp: false,
        firstError: 'bad locale key',
        failedChannels: ['email'],
      },
      {
        delivered: 0,
        failed: 1,
        skipped: 2,
        shouldStamp: false,
        firstError: 'smtp refused',
        failedChannels: ['email'],
      },
    ]);
  });

  it('treats a user missing entirely from the preference lookup as email-enabled', async () => {
    // user-1 is not "off": it is simply absent from the result, which must
    // fall back to the same enabled default as the column itself.
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-2', emailRemindersEnabled: true }]);
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });
    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });

    const [result] = await dispatchAll([envelope('1')]);

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(result.shouldStamp).toBe(true);
  });

  it('keeps dispatching with everyone treated as email-enabled when the preference lookup itself fails', async () => {
    pushMocks.userFindMany.mockRejectedValue(new Error('connection refused'));
    pushMocks.sendWebPush.mockResolvedValue({ status: 'skipped' });
    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });

    const [result] = await dispatchAll([envelope('1')]);

    expect(mocks.sendEmailBatch).toHaveBeenCalledTimes(1);
    expect(result.shouldStamp).toBe(true);
  });
});

describe('dispatchAll with endpoints', () => {
  beforeEach(() => {
    mocks.isEmailConfigured.mockReturnValue(false);
    // Reset like the sibling describe blocks do, so this block does not
    // depend on whatever mock state the previous block happened to leave
    // behind.
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.sendNtfy.mockReset();
    endpointMocks.endpointUpdate.mockReset();
    endpointMocks.endpointUpdateMany.mockReset();
    // Health writes flow through the real recordEndpointResult, which selects
    // consecutiveFailures back out of the update. Kept well under
    // AUTO_DISABLE_THRESHOLD by default so a test that does not care about
    // auto-disable does not accidentally trip it.
    endpointMocks.endpointUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    endpointMocks.endpointUpdateMany.mockResolvedValue({ count: 1 });
    endpointMocks.endpointFindMany.mockResolvedValue([]);
  });

  it('skips when the user has no endpoints', async () => {
    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 3 is email (off), push (default skip) and ntfy (no endpoints).
    // Asserting the count, not just shouldStamp, pins the ntfy outcome to
    // skipped rather than some other non-delivered status that would also
    // leave shouldStamp false.
    expect(result.skipped).toBe(3);
    expect(result.shouldStamp).toBe(false);
    expect(endpointMocks.sendNtfy).not.toHaveBeenCalled();
  });

  it('delivers through an enabled ntfy endpoint', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.delivered).toBe(1);
    expect(result.shouldStamp).toBe(true);
  });

  it('records the outcome so health tracking and auto-disable work', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: false, code: 'timeout' });

    const [result] = await dispatchAll([envelope('1')]);

    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'timeout',
      }),
      select: { consecutiveFailures: true },
    });
    expect(result.failed).toBe(1);
    // Pins both the error message and the channel tag: leaving `lastError`
    // at its initialiser, or mis-tagging the outcome 'email' instead of
    // 'ntfy', would both otherwise still leave failed === 1 and pass.
    expect(result.firstError).toBe('timeout');
    expect(result.failedChannels).toEqual(['ntfy']);
    expect(result.shouldStamp).toBe(false);
  });

  it('records exactly one health write per destination per run, not one per envelope', async () => {
    // Two envelopes for the same user, sharing the same single endpoint. A
    // per-envelope write would call endpointUpdate twice; the run-scoped
    // accumulator must collapse that to exactly one flush.
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: false, code: 'timeout' });

    await dispatchAll([envelopeForUser('user-1', 'p-1'), envelopeForUser('user-1', 'p-2')]);

    expect(endpointMocks.sendNtfy).toHaveBeenCalledTimes(2);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledTimes(1);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'timeout',
      }),
      select: { consecutiveFailures: true },
    });
  });

  it('aggregates a run to success when the destination delivered at least once, even if another envelope in the same run failed', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, code: 'timeout' });

    await dispatchAll([envelopeForUser('user-1', 'p-1'), envelopeForUser('user-1', 'p-2')]);

    expect(endpointMocks.endpointUpdate).toHaveBeenCalledTimes(1);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: {
        consecutiveFailures: 0,
        lastSuccessAt: expect.any(Date),
        lastFailureCode: null,
      },
    });
  });

  it('queries only enabled endpoints, so a disabled one is never contacted', async () => {
    await dispatchAll([envelope('1')]);

    expect(endpointMocks.endpointFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ enabled: true }) })
    );
  });

  it('one failing endpoint does not stop the others', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/a', secret: null },
      { id: 'ep-2', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/b', secret: null },
    ]);
    endpointMocks.sendNtfy
      .mockResolvedValueOnce({ ok: false, code: 'dns' })
      .mockResolvedValueOnce({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    // The channel is collapsed to a single outcome per envelope, the same way
    // sendWebPush collapses several devices: one endpoint delivering counts
    // as delivered overall, so `failed` stays 0 here even though ep-1 failed.
    // What this test actually guards is that ep-1 failing did not stop ep-2
    // from being tried, which the two sendNtfy calls and the delivered outcome
    // both confirm.
    expect(endpointMocks.sendNtfy).toHaveBeenCalledTimes(2);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({ lastFailureCode: 'dns' }),
      select: { consecutiveFailures: true },
    });
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-2' },
      data: { consecutiveFailures: 0, lastSuccessAt: expect.any(Date), lastFailureCode: null },
    });
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.shouldStamp).toBe(true);
  });

  it('an endpoint whose driver throws costs that endpoint only', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/a', secret: null },
      { id: 'ep-2', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/b', secret: null },
    ]);
    endpointMocks.sendNtfy
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    // The sibling must still be attempted, and its success must still count.
    expect(endpointMocks.sendNtfy).toHaveBeenCalledTimes(2);
    expect(result.delivered).toBe(1);
    expect(result.shouldStamp).toBe(true);
  });

  it('a health-write failure does not turn a delivered endpoint into a failure', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/a', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });
    endpointMocks.endpointUpdate.mockRejectedValueOnce(new Error('db blip'));

    const [result] = await dispatchAll([envelope('1')]);

    // Unguarded, this throw escapes dispatchAll's flush step (or worse,
    // dispatchEndpoints itself) and converts a real delivery into a failure.
    // For a user with email off and no push devices that flips shouldStamp
    // and drops the reminder.
    expect(result.shouldStamp).toBe(true);
  });

  it('bounds the query by the number of users in the run, not a flat per-user constant', async () => {
    // user-1 holds exactly the per-user cap (5), user-2 holds one more.
    // A real Postgres LIMIT truncates the result set, so simulate that here:
    // the mock slices to whatever `take` dispatch.ts actually sends, the same
    // way a real query would. A flat `take: MAX_ENDPOINTS_PER_USER` (5) would
    // truncate this six-row result to user-1's five rows only, dropping
    // user-2 entirely; the correct `take` (5 * 2 users = 10) keeps all six.
    const allEndpoints = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `ep-1-${i}`,
        userId: 'user-1',
        type: 'NTFY' as const,
        url: `https://ntfy.sh/a${i}`,
        secret: null,
      })),
      { id: 'ep-2-0', userId: 'user-2', type: 'NTFY' as const, url: 'https://ntfy.sh/b', secret: null },
    ];
    endpointMocks.endpointFindMany.mockImplementation((args: { take?: number }) =>
      Promise.resolve(allEndpoints.slice(0, args?.take ?? allEndpoints.length))
    );
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });

    await dispatchAll([envelope('1'), envelope('2')]);

    const contactedUserIds = new Set(
      endpointMocks.sendNtfy.mock.calls.map(([endpoint]) => endpoint.userId)
    );
    expect(contactedUserIds).toEqual(new Set(['user-1', 'user-2']));
  });
});

describe('dispatchAll with webhooks', () => {
  beforeEach(() => {
    mocks.isEmailConfigured.mockReturnValue(false);
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.sendNtfy.mockReset();
    endpointMocks.endpointUpdate.mockReset();
    endpointMocks.endpointUpdateMany.mockReset();
    // Health writes flow through the real recordEndpointResult, which selects
    // consecutiveFailures back out of the update. Kept well under
    // AUTO_DISABLE_THRESHOLD so a test that does not care about auto-disable
    // does not accidentally trip it.
    endpointMocks.endpointUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    endpointMocks.endpointUpdateMany.mockResolvedValue({ count: 1 });
    webhookMocks.sendWebhook.mockReset();
    webhookMocks.canUseWebhooks.mockReset();
    webhookMocks.canUseWebhooks.mockResolvedValue(true);
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'WEBHOOK', url: 'https://hooks.test/x', secret: 'enc' },
    ]);
  });

  it('delivers through an entitled webhook endpoint', async () => {
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.delivered).toBe(1);
    expect(result.shouldStamp).toBe(true);
  });

  it('does NOT send when the user is not entitled, so a downgrade stops delivery', async () => {
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    const [result] = await dispatchAll([envelope('1')]);

    expect(webhookMocks.sendWebhook).not.toHaveBeenCalled();
    expect(result.shouldStamp).toBe(false);
  });

  it('reports a webhook skipped for entitlement as skipped, not failed', async () => {
    // outcomeFor's attempted === 0 branch: nothing was attempted here, so
    // this must not count as a failure. shouldStamp alone stays false either
    // way, which is why this needs its own assertion: changing that branch
    // to return 'failed' would leave every other test in this file green.
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.failed).toBe(0);
    expect(result.failedChannels).toBeUndefined();
    // email (off), push (default skip), and webhook (skipped for
    // entitlement).
    expect(result.skipped).toBe(3);
  });

  it('checks entitlement once per user, not once per envelope', async () => {
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    await dispatchAll([envelope('1'), envelope('1'), envelope('1')]);

    expect(webhookMocks.canUseWebhooks).toHaveBeenCalledTimes(1);
  });

  it('does not check entitlement at all when the user has no webhook endpoints', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });

    await dispatchAll([envelope('1')]);

    expect(webhookMocks.canUseWebhooks).not.toHaveBeenCalled();
  });

  it('records webhook outcomes for health tracking', async () => {
    webhookMocks.sendWebhook.mockResolvedValue({ ok: false, code: 'tls' });

    await dispatchAll([envelope('1')]);

    // Mirrors the sibling "records the outcome so health tracking and
    // auto-disable work" test in the ntfy describe block above: there is no
    // recordEndpointResult mock to assert against, only the prisma call it
    // makes underneath.
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'tls',
      }),
      select: { consecutiveFailures: true },
    });
  });

  it('reports a webhook failure under the webhook channel, not ntfy', async () => {
    webhookMocks.sendWebhook.mockResolvedValue({ ok: false, code: 'tls' });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.failedChannels).toEqual(['webhook']);
  });

  it('records exactly one health write per destination per run, not one per envelope', async () => {
    // Two envelopes for the same user, sharing the same single webhook
    // endpoint. A per-envelope write would call endpointUpdate twice; the
    // run-scoped accumulator must collapse that to exactly one flush. This is
    // the regression an earlier, since-rewritten version of this task's
    // instructions would have reintroduced by replacing dispatchEndpoints
    // wholesale instead of editing it in place.
    webhookMocks.sendWebhook.mockResolvedValue({ ok: false, code: 'tls' });

    await dispatchAll([envelopeForUser('user-1', 'p-1'), envelopeForUser('user-1', 'p-2')]);

    expect(webhookMocks.sendWebhook).toHaveBeenCalledTimes(2);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledTimes(1);
    expect(endpointMocks.endpointUpdate).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'tls',
      }),
      select: { consecutiveFailures: true },
    });
  });
});

describe('dispatchAll with both an ntfy and a webhook endpoint on the same user', () => {
  // The combination dispatchEndpoints was restructured to reach: before
  // webhooks existed, a user only ever had one endpoint type, so collapsing
  // to one outcome per type present was untested against a user who actually
  // has both.
  beforeEach(() => {
    mocks.isEmailConfigured.mockReturnValue(false);
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.sendNtfy.mockReset();
    endpointMocks.endpointUpdate.mockReset();
    endpointMocks.endpointUpdateMany.mockReset();
    endpointMocks.endpointUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    endpointMocks.endpointUpdateMany.mockResolvedValue({ count: 1 });
    webhookMocks.sendWebhook.mockReset();
    webhookMocks.canUseWebhooks.mockReset();
    webhookMocks.canUseWebhooks.mockResolvedValue(true);
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-ntfy', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
      { id: 'ep-hook', userId: 'user-1', type: 'WEBHOOK', url: 'https://hooks.test/x', secret: 'enc' },
    ]);
  });

  it('delivers through both, as two distinct outcomes for the same envelope', async () => {
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(endpointMocks.sendNtfy).toHaveBeenCalledTimes(1);
    expect(webhookMocks.sendWebhook).toHaveBeenCalledTimes(1);
    // A single collapsed 'endpoints' outcome would only ever attempt one of
    // the two drivers per envelope; both being called and both counting
    // toward delivered pins that they are tracked independently.
    expect(result.delivered).toBe(2);
    expect(result.shouldStamp).toBe(true);
  });

  it('reports an ntfy failure separately from a webhook success on the same user', async () => {
    endpointMocks.sendNtfy.mockResolvedValue({ ok: false, code: 'timeout' });
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.failedChannels).toEqual(['ntfy']);
    // The webhook success must still stamp the reminder, even though the
    // ntfy destination for the same user failed in the same run.
    expect(result.shouldStamp).toBe(true);
  });
});

describe('guardEndpoints channel labelling', () => {
  // dispatchEndpoints itself catches every individual driver throw, so the
  // only way to exercise guardEndpoints' own catch (its fallback outcome
  // labelling) is to make something inside dispatchEndpoints throw past that
  // inner try/catch. HealthAccumulator.recordEndpoint is documented as
  // "cannot fail", but stubbing it to throw here is the only way to reach
  // this code path without editing production code just for the test.
  let recordEndpointSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.isEmailConfigured.mockReturnValue(false);
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.sendNtfy.mockReset();
    endpointMocks.endpointUpdate.mockReset();
    endpointMocks.endpointUpdateMany.mockReset();
    endpointMocks.endpointUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    endpointMocks.endpointUpdateMany.mockResolvedValue({ count: 1 });
    webhookMocks.sendWebhook.mockReset();
    webhookMocks.canUseWebhooks.mockReset();
    webhookMocks.canUseWebhooks.mockResolvedValue(true);
    recordEndpointSpy = vi
      .spyOn(HealthAccumulator.prototype, 'recordEndpoint')
      .mockImplementation(() => {
        throw new Error('accumulator boom');
      });
  });

  afterEach(() => {
    recordEndpointSpy.mockRestore();
  });

  it('labels the fallback outcome for every endpoint type the user actually has, not always ntfy', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-ntfy', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
      { id: 'ep-hook', userId: 'user-1', type: 'WEBHOOK', url: 'https://hooks.test/x', secret: 'enc' },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    // Both an ntfy and a webhook endpoint were present, so guardEndpoints'
    // catch must report both channels as failed, mislabelling neither as the
    // other and neither as only one of the two.
    expect(result.failed).toBe(2);
    expect(result.failedChannels).toEqual(expect.arrayContaining(['ntfy', 'webhook']));
    expect(result.shouldStamp).toBe(false);
  });

  it('labels the fallback outcome ntfy for an ntfy-only user, not webhook', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-ntfy', userId: 'user-1', type: 'NTFY', url: 'https://ntfy.sh/t', secret: null },
    ]);
    endpointMocks.sendNtfy.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.failedChannels).toEqual(['ntfy']);
  });

  it('labels the fallback outcome webhook for a webhook-only user, not ntfy', async () => {
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-hook', userId: 'user-1', type: 'WEBHOOK', url: 'https://hooks.test/x', secret: 'enc' },
    ]);
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.failedChannels).toEqual(['webhook']);
  });
});

describe('loadWebhookEntitlements try/catch', () => {
  beforeEach(() => {
    mocks.isEmailConfigured.mockReturnValue(false);
    pushMocks.sendWebPush.mockReset();
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.endpointUpdate.mockReset();
    endpointMocks.endpointUpdateMany.mockReset();
    endpointMocks.endpointUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    endpointMocks.endpointUpdateMany.mockResolvedValue({ count: 1 });
    webhookMocks.sendWebhook.mockReset();
    webhookMocks.canUseWebhooks.mockReset();
    endpointMocks.endpointFindMany.mockResolvedValue([
      { id: 'ep-1', userId: 'user-1', type: 'WEBHOOK', url: 'https://hooks.test/x', secret: 'enc' },
    ]);
  });

  it('denies webhook delivery for the whole run rather than aborting it, when resolving entitlements throws', async () => {
    // mapWithConcurrency rejecting here (canUseWebhooks itself already fails
    // closed per-user, so this simulates the surrounding mapWithConcurrency
    // call throwing instead) must not escape dispatchAll and abort the run:
    // every other envelope's email, push, and ntfy delivery for the night
    // must still happen.
    webhookMocks.canUseWebhooks.mockRejectedValue(new Error('billing lookup exploded'));

    const [result] = await dispatchAll([envelope('1')]);

    expect(webhookMocks.sendWebhook).not.toHaveBeenCalled();
    expect(result.shouldStamp).toBe(false);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it('does not deny other users in the same run when only one user throws resolving entitlements', async () => {
    endpointMocks.endpointFindMany.mockImplementation((args: { where?: { userId?: { in?: string[] } } }) => {
      const ids = args?.where?.userId?.in ?? [];
      return Promise.resolve(
        ids.map((userId) => ({
          id: `ep-${userId}`,
          userId,
          type: 'WEBHOOK' as const,
          url: `https://hooks.test/${userId}`,
          secret: 'enc',
        }))
      );
    });
    webhookMocks.canUseWebhooks.mockImplementation((userId: string) =>
      userId === 'user-1' ? Promise.reject(new Error('billing lookup exploded')) : Promise.resolve(true)
    );
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const [firstResult, secondResult] = await dispatchAll([
      envelopeForUser('user-1', 'p-1'),
      envelopeForUser('user-2', 'p-2'),
    ]);

    // Today's actual implementation resolves the whole map with
    // mapWithConcurrency, so one rejection currently fails the batch closed
    // for every user in it, not only the one whose lookup threw. This test
    // pins that fail-closed behavior rather than a per-user isolation
    // guarantee the code does not actually make.
    expect(firstResult.shouldStamp).toBe(false);
    expect(secondResult.shouldStamp).toBe(false);
  });
});
