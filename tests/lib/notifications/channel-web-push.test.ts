import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NotificationEnvelope } from '../../../lib/notifications/types';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  update: vi.fn(),
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
      update: mocks.update,
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

// Mocked so the fake-timer test below cannot get stuck on the dynamic
// `import(...)` this module's real implementation uses to load locale JSON,
// which involves Vite's own async module graph and is not something fake
// timers can drive to completion. The values match what the real renderer
// produces for a 'contact' envelope, so the "sends a rendered payload" test
// below is unaffected.
vi.mock('../../../lib/notifications/render', () => ({
  renderShortForm: vi.fn().mockResolvedValue({ title: 'Ana Torres', body: 'Time to catch up' }),
}));

import { sendWebPush } from '../../../lib/notifications/channels/web-push';
import { HealthAccumulator } from '../../../lib/notifications/endpoint-health';

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
  let health: HealthAccumulator;

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
    mocks.update.mockResolvedValue({ consecutiveFailures: 0 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    // sendWebPush only accumulates outcomes in memory now; a real
    // HealthAccumulator, flushed explicitly where a test cares about the
    // resulting prisma write, is what actually exercises that path end to
    // end rather than mocking it away.
    health = new HealthAccumulator();
  });

  it('skips when push is not configured on this server', async () => {
    mocks.getVapidDetails.mockReturnValue(null);

    expect(await sendWebPush(envelope, health)).toEqual({ channel: 'web_push', status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('skips when the user has no subscribed devices', async () => {
    mocks.findMany.mockResolvedValue([]);

    expect(await sendWebPush(envelope, health)).toEqual({ channel: 'web_push', status: 'skipped' });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('sends a rendered payload carrying the deep link', async () => {
    const result = await sendWebPush(envelope, health);

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
    await sendWebPush(envelope, health);

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', autoDisabledAt: null } })
    );
  });

  it('caps the subscription lookup, as a belt behind the per-user write cap', async () => {
    await sendWebPush(envelope, health);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });

  it('reports delivered when at least one of several devices succeeds', async () => {
    mocks.findMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')]);
    mocks.sendNotification
      .mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
      .mockResolvedValueOnce({ statusCode: 201 });

    expect(await sendWebPush(envelope, health)).toEqual({ channel: 'web_push', status: 'delivered' });
    await health.flush();

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

    const result = await sendWebPush(envelope, health);
    await health.flush();

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

    const result = await sendWebPush(envelope, health);

    expect(result.status).toBe('failed');
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('fails rather than throwing when every device fails', async () => {
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unavailable'), { statusCode: 500 })
    );

    const result = await sendWebPush(envelope, health);

    expect(result.status).toBe('failed');
  });

  it('records a failure against a kept-alive device without disabling it before the threshold', async () => {
    mocks.update.mockResolvedValue({ consecutiveFailures: 3 });
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unavailable'), { statusCode: 503 })
    );

    await sendWebPush(envelope, health);
    await health.flush();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { consecutiveFailures: { increment: 1 }, lastFailureCode: 'http_5xx' },
      select: { consecutiveFailures: true },
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('auto-disables a device that has failed repeatedly for a reason other than 404/410', async () => {
    // A VAPID key rotation is the motivating case: every send to this device
    // now fails the same way (401, in real life), forever, with no 404/410 to
    // trigger the pruning path. Auto-disable is the only exit.
    mocks.update.mockResolvedValue({ consecutiveFailures: 10 });
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('unauthorized'), { statusCode: 401 })
    );

    const result = await sendWebPush(envelope, health);
    await health.flush();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'http_4xx',
      },
      select: { consecutiveFailures: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'sub-1', autoDisabledAt: null },
      data: { autoDisabledAt: expect.any(Date) },
    });
    // The subscription is disabled, not deleted: it must survive so that a
    // fixed key rotation can bring it back to life without the user
    // re-granting permission.
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });

  it('treats exactly 500 as a 5xx failure code, not 4xx', async () => {
    // Pins the boundary itself: a mutation from `>= 500` to `> 500` would
    // silently mis-file this as http_4xx and go unnoticed otherwise.
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('internal error'), { statusCode: 500 })
    );

    await sendWebPush(envelope, health);
    await health.flush();

    expect(mocks.update.mock.calls[0][0].data.lastFailureCode).toBe('http_5xx');
  });

  it('maps a 429 from the push service to http_429, distinct from http_4xx', async () => {
    // A push service's own rate limit is just as transient, and just as
    // wrongly-attributed if folded into the generic 4xx bucket, as ntfy's is.
    mocks.sendNotification.mockRejectedValue(
      Object.assign(new Error('too many requests'), { statusCode: 429 })
    );

    await sendWebPush(envelope, health);
    await health.flush();

    expect(mocks.update.mock.calls[0][0].data.lastFailureCode).toBe('http_429');
    // http_429 must not count toward auto-disable either, the same rule as
    // the ntfy endpoint path.
    expect(mocks.update.mock.calls[0][0].data.consecutiveFailures).toBeUndefined();
  });

  it('times out a send that never resolves, rather than hanging the run', async () => {
    // web-push's own `timeout` option is a socket-inactivity timer, not a
    // total deadline: a promise that simply never settles is what a
    // trickling push service looks like from here, and this channel's own
    // deadline (not the library's) is what must catch it.
    vi.useFakeTimers();
    mocks.sendNotification.mockReturnValue(new Promise(() => {}));

    const resultPromise = sendWebPush(envelope, health);
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;
    await health.flush();

    expect(result.status).toBe('failed');
    expect(mocks.update.mock.calls[0][0].data.lastFailureCode).toBe('timeout');
    vi.useRealTimers();
  });

  it('does not let a health-write failure abandon the rest of the devices in the run', async () => {
    // sub-1's health write throws (a transient DB blip). That must not be
    // mistaken for a delivery failure, and it must not stop sub-2 from being
    // sent to, recorded in the accumulator, or flushed correctly.
    mocks.findMany.mockResolvedValue([subscription('sub-1'), subscription('sub-2')]);
    mocks.update.mockRejectedValueOnce(new Error('connection reset')).mockResolvedValueOnce({});

    const result = await sendWebPush(envelope, health);
    await health.flush();

    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ channel: 'web_push', status: 'delivered' });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'sub-2' },
      data: expect.objectContaining({ consecutiveFailures: 0 }),
    });
  });
});
