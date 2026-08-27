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

vi.mock('../../../lib/prisma', () => ({
  prisma: { user: { findMany: pushMocks.userFindMany } },
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

    // skipped: 1 is the push channel, which has no subscriptions configured
    // in this test and so reports skipped by default.
    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 1, shouldStamp: true });
  });

  it('does NOT stamp when email is not configured, so the send is not burned', async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 2 is email (not configured) plus push (no subscriptions).
    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 2, shouldStamp: false });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('does NOT stamp when the provider reports the send as skipped', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: true,
      results: [{ success: true, skipped: true, message: 'Email not configured' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.shouldStamp).toBe(false);
    // 2, not 1: the email channel skip plus the push channel's default skip
    // (no subscriptions configured in this test).
    expect(result.skipped).toBe(2);
    expect(result.delivered).toBe(0);
  });

  it('does NOT stamp a failed send', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: false, error: 'smtp refused' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    // skipped: 1 is the push channel, which has no subscriptions configured
    // in this test and so reports skipped by default.
    expect(result).toEqual({ delivered: 0, failed: 1, skipped: 1, shouldStamp: false });
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

    // skipped: 1 is the push channel, which has no subscriptions configured
    // in this test and so reports skipped by default.
    expect(result).toEqual({ delivered: 0, failed: 1, skipped: 1, shouldStamp: false });
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
  });

  it('stamps when push delivered even though email failed', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: false, error: 'smtp refused' }],
    });
    pushMocks.sendWebPush.mockResolvedValue({ status: 'delivered' });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result).toEqual({ delivered: 1, failed: 1, skipped: 0, shouldStamp: true });
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

    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 2, shouldStamp: false });
  });

  it('treats a thrown push driver as a channel failure, not a crash', async () => {
    mocks.sendEmailBatch.mockResolvedValue({ success: true, results: [{ success: true }] });
    pushMocks.sendWebPush.mockRejectedValue(new Error('driver blew up'));

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.shouldStamp).toBe(true);
  });
});
