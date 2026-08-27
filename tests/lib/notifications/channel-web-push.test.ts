import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  getVapidDetails: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
      update: mocks.update,
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock('../../../lib/notifications/vapid', () => ({
  getVapidDetails: mocks.getVapidDetails,
  isPushConfigured: () => mocks.getVapidDetails() !== null,
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: mocks.setVapidDetails,
    sendNotification: mocks.sendNotification,
  },
}));

import { sendWebPush } from '../../../lib/notifications/channels/web-push';

const envelope: NotificationEnvelope = {
  userId: 'user-1',
  userEmail: 'user@example.com',
  locale: 'en',
  notification: {
    kind: 'contact',
    personId: 'person-1',
    personName: 'Ana Torres',
    lastContactFormatted: null,
    intervalText: '3 months',
  },
  unsubscribeUrl: 'https://app.test/unsubscribe?token=tok',
  deepLink: 'https://app.test/people/person-1',
  stamp: { model: 'person', id: 'person-1', field: 'lastContactReminderSent' },
  logMeta: {},
};

function subscription(id: string) {
  return { id, endpoint: `https://push.test/${id}`, p256dh: 'key', auth: 'auth' };
}

describe('sendWebPush', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.getVapidDetails.mockReturnValue({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:a@b.test',
    });
    mocks.findMany.mockResolvedValue([subscription('sub-1')]);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    mocks.update.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: 0 });
  });

  it('skips when push is not configured on this server', async () => {
    mocks.getVapidDetails.mockReturnValue(null);

    expect(await sendWebPush(envelope)).toEqual({ channel: 'web_push', status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('skips when the user has no subscribed devices', async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await sendWebPush(envelope)).toEqual({ channel: 'web_push', status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('sends a rendered payload carrying the deep link', async () => {
    const result = await sendWebPush(envelope);

    expect(result).toEqual({ channel: 'web_push', status: 'delivered' });
    const payload = JSON.parse(mocks.sendNotification.mock.calls[0][1] as string);
    expect(payload).toEqual({
      title: 'Ana Torres',
      body: 'Time to catch up',
      url: 'https://app.test/people/person-1',
      tag: 'contact:person-1',
    });
  });

  it('scopes the subscription lookup to the envelope owner and skips auto-disabled devices', async () => {
    // Every other test in this file stubs findMany and ignores the arguments
    // it was called with. Dropping the userId filter would broadcast every
    // user's push, including contact names, to every subscribed device on
    // the instance, and none of those tests would notice.
    await sendWebPush(envelope);

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', autoDisabledAt: null } })
    );
  });

  it('caps the subscription lookup, as a belt behind the per-user write cap', async () => {
    await sendWebPush(envelope);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });

  it('reports delivered when at least one of several devices succeeds', async () => {
    mocks.findMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')]);
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });

    expect(await sendWebPush(envelope)).toEqual({ channel: 'web_push', status: 'delivered' });

    // Health must be recorded for the live device and only the live device.
    // If success handling ever widened to include a device that failed, this
    // is what catches it.
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-2' },
      data: expect.objectContaining({
        consecutiveFailures: 0,
        lastSuccessAt: expect.any(Date),
        lastFailureCode: null,
        autoDisabledAt: null,
      }),
    });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['sub-1'] } } });
  });

  it('prunes subscriptions the push service reports as 404 or 410', async () => {
    mocks.findMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')]);
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('not found'), { statusCode: 404 }))
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

    const result = await sendWebPush(envelope);

    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['sub-1', 'sub-2'] } } });

    // Every device was gone, so nothing was delivered. This must be `failed`,
    // not `skipped`: skipped means "there was nothing to deliver to", and the
    // dispatcher accounts for the two differently.
    expect(result).toEqual({ channel: 'web_push', status: 'failed', error: 'gone' });
    // Pruned rows are deleted outright, so there is nothing left to record
    // health against.
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('does NOT prune on a transient server error', async () => {
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unavailable'), { statusCode: 503 })
    );

    const result = await sendWebPush(envelope);

    expect(result.status).toBe('failed');
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('fails rather than throwing when every device fails', async () => {
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unavailable'), { statusCode: 500 })
    );

    const result = await sendWebPush(envelope);

    expect(result.status).toBe('failed');
  });

  it('records a failure against a kept-alive device without disabling it before the threshold', async () => {
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: 2 });
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unavailable'), { statusCode: 503 })
    );

    await sendWebPush(envelope);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ consecutiveFailures: 3, lastFailureCode: 'http_5xx' }),
    });
    expect(mocks.update.mock.calls[0][0].data.autoDisabledAt).toBeUndefined();
  });

  it('auto-disables a device that has failed repeatedly for a reason other than 404/410', async () => {
    // A VAPID key rotation is the motivating case: every send to this device
    // now fails the same way (401, in real life), forever, with no 404/410 to
    // trigger the pruning path. Auto-disable is the only exit.
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: 9 });
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { statusCode: 401 })
    );

    const result = await sendWebPush(envelope);

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        consecutiveFailures: 10,
        lastFailureCode: 'http_4xx',
        autoDisabledAt: expect.any(Date),
      }),
    });
    // The subscription is disabled, not deleted: it must survive so that a
    // fixed key rotation can bring it back to life without the user
    // re-granting permission.
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });

  it('skips a device that is already auto-disabled rather than sending to it', async () => {
    // findMany is the enforcement point: an auto-disabled row must never be
    // returned in the first place. This test pins the query result, not the
    // implementation, to catch a regression that widened the where clause.
    mocks.findMany.mockResolvedValue([]);

    const result = await sendWebPush(envelope);

    expect(result).toEqual({ channel: 'web_push', status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});
