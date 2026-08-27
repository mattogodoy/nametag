import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  findUnique: vi.fn(),
  pushUpdate: vi.fn(),
  pushFindUnique: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    notificationEndpoint: { update: mocks.update, findUnique: mocks.findUnique },
    pushSubscription: { update: mocks.pushUpdate, findUnique: mocks.pushFindUnique },
  },
}));

import {
  recordEndpointResult,
  recordPushSubscriptionResult,
  AUTO_DISABLE_THRESHOLD,
} from '../../../lib/notifications/endpoint-health';

describe('recordEndpointResult', () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.findUnique.mockReset();
    mocks.update.mockResolvedValue({});
  });

  it('resets the failure counter on success', async () => {
    await recordEndpointResult('ep-1', { ok: true });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: expect.objectContaining({
        consecutiveFailures: 0,
        lastFailureCode: null,
        autoDisabledAt: null,
      }),
    });
  });

  it('increments the counter and records the coarse code on failure', async () => {
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: 2 });

    await recordEndpointResult('ep-1', { ok: false, code: 'http_5xx' });

    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      consecutiveFailures: 3,
      lastFailureCode: 'http_5xx',
    });
  });

  it('does not disable before the threshold', async () => {
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 2 });

    await recordEndpointResult('ep-1', { ok: false, code: 'timeout' });

    const data = mocks.update.mock.calls[0][0].data;
    expect(data.enabled).toBeUndefined();
    expect(data.autoDisabledAt).toBeUndefined();
  });

  it('disables exactly at the threshold', async () => {
    mocks.findUnique.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 1 });

    await recordEndpointResult('ep-1', { ok: false, code: 'timeout' });

    const data = mocks.update.mock.calls[0][0].data;
    expect(data.consecutiveFailures).toBe(AUTO_DISABLE_THRESHOLD);
    expect(data.enabled).toBe(false);
    expect(data.autoDisabledAt).toBeInstanceOf(Date);
  });

  it('re-enabling clears the disabled marker, so a fixed endpoint recovers cleanly', async () => {
    await recordEndpointResult('ep-1', { ok: true });

    expect(mocks.update.mock.calls[0][0].data.autoDisabledAt).toBeNull();
  });

  it('tolerates a vanished endpoint without throwing', async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(recordEndpointResult('gone', { ok: false, code: 'dns' })).resolves.toBeUndefined();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe('recordPushSubscriptionResult', () => {
  beforeEach(() => {
    mocks.pushUpdate.mockReset();
    mocks.pushFindUnique.mockReset();
    mocks.pushUpdate.mockResolvedValue({});
  });

  it('resets the failure counter on success, without touching lastSuccessAt semantics owned elsewhere', async () => {
    await recordPushSubscriptionResult('sub-1', { ok: true });

    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({
        consecutiveFailures: 0,
        lastFailureCode: null,
        autoDisabledAt: null,
      }),
    });
  });

  it('increments the counter and records the coarse code on failure', async () => {
    mocks.pushFindUnique.mockResolvedValue({ consecutiveFailures: 2 });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'http_5xx' });

    expect(mocks.pushUpdate.mock.calls[0][0].data).toMatchObject({
      consecutiveFailures: 3,
      lastFailureCode: 'http_5xx',
    });
  });

  it('does not disable before the threshold', async () => {
    mocks.pushFindUnique.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 2 });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'timeout' });

    expect(mocks.pushUpdate.mock.calls[0][0].data.autoDisabledAt).toBeUndefined();
  });

  it('disables exactly at the threshold, with no enabled flag since PushSubscription has none', async () => {
    mocks.pushFindUnique.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 1 });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'timeout' });

    const data = mocks.pushUpdate.mock.calls[0][0].data;
    expect(data.consecutiveFailures).toBe(AUTO_DISABLE_THRESHOLD);
    expect(data.autoDisabledAt).toBeInstanceOf(Date);
    expect(data.enabled).toBeUndefined();
  });

  it('re-enabling clears the disabled marker, so a fixed device recovers cleanly', async () => {
    await recordPushSubscriptionResult('sub-1', { ok: true });

    expect(mocks.pushUpdate.mock.calls[0][0].data.autoDisabledAt).toBeNull();
  });

  it('tolerates a vanished subscription without throwing', async () => {
    mocks.pushFindUnique.mockResolvedValue(null);

    await expect(
      recordPushSubscriptionResult('gone', { ok: false, code: 'dns' })
    ).resolves.toBeUndefined();
    expect(mocks.pushUpdate).not.toHaveBeenCalled();
  });
});
