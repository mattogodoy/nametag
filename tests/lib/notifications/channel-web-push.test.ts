import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  getVapidDetails: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
      updateMany: mocks.updateMany,
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
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('skips when push is not configured on this server', async () => {
    mocks.getVapidDetails.mockReturnValue(null);

    expect(await sendWebPush(envelope)).toEqual({ status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('skips when the user has no subscribed devices', async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await sendWebPush(envelope)).toEqual({ status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('sends a rendered payload carrying the deep link', async () => {
    const result = await sendWebPush(envelope);

    expect(result).toEqual({ status: 'delivered' });
    const payload = JSON.parse(mocks.sendNotification.mock.calls[0][1] as string);
    expect(payload).toEqual({
      title: 'Ana Torres',
      body: 'Time to catch up',
      url: 'https://app.test/people/person-1',
      tag: 'contact:person-1',
    });
  });

  it('reports delivered when at least one of several devices succeeds', async () => {
    mocks.findMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')]);
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });

    expect(await sendWebPush(envelope)).toEqual({ status: 'delivered' });

    // lastSuccessAt must move for the live device and only the live device. If
    // `alive` ever widened to include a device that failed, this is what
    // catches it.
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['sub-2'] } },
      data: { lastSuccessAt: expect.any(Date) },
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
    expect(result).toEqual({ status: 'failed', error: 'gone' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
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
});
