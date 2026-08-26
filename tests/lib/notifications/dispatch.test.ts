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

    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 0, shouldStamp: true });
  });

  it('does NOT stamp when email is not configured, so the send is not burned', async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    const [result] = await dispatchAll([envelope('1')]);

    expect(result).toEqual({ delivered: 0, failed: 0, skipped: 1, shouldStamp: false });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });

  it('does NOT stamp when the provider reports the send as skipped', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: true,
      results: [{ success: true, skipped: true, message: 'Email not configured' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result.shouldStamp).toBe(false);
    expect(result.skipped).toBe(1);
    expect(result.delivered).toBe(0);
  });

  it('does NOT stamp a failed send', async () => {
    mocks.sendEmailBatch.mockResolvedValue({
      success: false,
      results: [{ success: false, error: 'smtp refused' }],
    });

    const [result] = await dispatchAll([envelope('1')]);

    expect(result).toEqual({ delivered: 0, failed: 1, skipped: 0, shouldStamp: false });
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

    expect(result).toEqual({ delivered: 0, failed: 1, skipped: 0, shouldStamp: false });
    expect(mocks.sendEmailBatch).not.toHaveBeenCalled();
  });
});
