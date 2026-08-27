import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  updateMany: vi.fn(),
  pushUpdate: vi.fn(),
  pushFindUnique: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    notificationEndpoint: { update: mocks.update, updateMany: mocks.updateMany },
    pushSubscription: { update: mocks.pushUpdate, findUnique: mocks.pushFindUnique },
  },
}));

import {
  recordEndpointResult,
  recordPushSubscriptionResult,
  AUTO_DISABLE_THRESHOLD,
} from '../../../lib/notifications/endpoint-health';

function notFoundError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('recordEndpointResult', () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.updateMany.mockReset();
    mocks.update.mockResolvedValue({ consecutiveFailures: 0 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it('resets the failure counter on success without touching enabled or autoDisabledAt', async () => {
    await recordEndpointResult('ep-1', { ok: true });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: {
        consecutiveFailures: 0,
        lastSuccessAt: expect.any(Date),
        lastFailureCode: null,
      },
    });
    const data = mocks.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('enabled');
    expect(data).not.toHaveProperty('autoDisabledAt');
  });

  it('leaves an endpoint disabled by another route disabled after a success', async () => {
    // The pairing invariant this pins: a success must never produce
    // enabled: false, autoDisabledAt: null, which renders as healthy while
    // delivering nothing and offering no way back.
    await recordEndpointResult('ep-1', { ok: true });

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('atomically increments the counter and records the coarse code on failure', async () => {
    mocks.update.mockResolvedValue({ consecutiveFailures: 3 });

    await recordEndpointResult('ep-1', { ok: false, code: 'http_5xx' });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: {
        consecutiveFailures: { increment: 1 },
        lastFailureAt: expect.any(Date),
        lastFailureCode: 'http_5xx',
      },
      select: { consecutiveFailures: true },
    });
  });

  it('does not disable before the threshold', async () => {
    mocks.update.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 1 });

    await recordEndpointResult('ep-1', { ok: false, code: 'timeout' });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('disables exactly at the threshold, guarded on autoDisabledAt being unset', async () => {
    mocks.update.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD });

    await recordEndpointResult('ep-1', { ok: false, code: 'timeout' });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 'ep-1', autoDisabledAt: null },
      data: { enabled: false, autoDisabledAt: expect.any(Date) },
    });
  });

  it('tolerates a vanished endpoint without throwing, on success', async () => {
    mocks.update.mockRejectedValue(notFoundError());

    await expect(recordEndpointResult('gone', { ok: true })).resolves.toBeUndefined();
  });

  it('tolerates a vanished endpoint without throwing, on failure', async () => {
    mocks.update.mockRejectedValue(notFoundError());

    await expect(
      recordEndpointResult('gone', { ok: false, code: 'dns' })
    ).resolves.toBeUndefined();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('propagates an unexpected database error rather than swallowing it', async () => {
    mocks.update.mockRejectedValue(new Error('connection reset'));

    await expect(recordEndpointResult('ep-1', { ok: true })).rejects.toThrow('connection reset');
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
