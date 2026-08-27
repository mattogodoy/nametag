import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

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
  recordEndpointResult: vi.fn(),
}));

vi.mock('../../../lib/notifications/channels/ntfy', () => ({ sendNtfy: endpointMocks.sendNtfy }));
vi.mock('../../../lib/notifications/endpoint-health', () => ({
  recordEndpointResult: endpointMocks.recordEndpointResult,
  AUTO_DISABLE_THRESHOLD: 10,
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    user: { findMany: pushMocks.userFindMany },
    notificationEndpoint: { findMany: endpointMocks.endpointFindMany },
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
    pushMocks.sendWebPush.mockResolvedValue({ channel: 'web_push', status: 'skipped' });
    pushMocks.userFindMany.mockResolvedValue([{ id: 'user-1', emailRemindersEnabled: false }]);
    endpointMocks.endpointFindMany.mockReset();
    endpointMocks.sendNtfy.mockReset();
    endpointMocks.recordEndpointResult.mockReset();
    endpointMocks.recordEndpointResult.mockResolvedValue(undefined);
    endpointMocks.endpointFindMany.mockResolvedValue([]);
  });

  it('skips when the user has no endpoints', async () => {
    const [result] = await dispatchAll([envelope('1')]);

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

    expect(endpointMocks.recordEndpointResult).toHaveBeenCalledWith('ep-1', {
      ok: false,
      code: 'timeout',
    });
    expect(result.failed).toBe(1);
    expect(result.shouldStamp).toBe(false);
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
    expect(endpointMocks.recordEndpointResult).toHaveBeenCalledWith('ep-1', {
      ok: false,
      code: 'dns',
    });
    expect(endpointMocks.recordEndpointResult).toHaveBeenCalledWith('ep-2', { ok: true });
    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.shouldStamp).toBe(true);
  });
});
