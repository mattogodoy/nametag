import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  updateMany: vi.fn(),
  pushUpdate: vi.fn(),
  pushUpdateMany: vi.fn(),
}));

vi.mock('../../../lib/prisma', () => ({
  prisma: {
    notificationEndpoint: { update: mocks.update, updateMany: mocks.updateMany },
    pushSubscription: { update: mocks.pushUpdate, updateMany: mocks.pushUpdateMany },
  },
}));

import {
  recordEndpointResult,
  recordPushSubscriptionResult,
  AUTO_DISABLE_THRESHOLD,
  HealthAccumulator,
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

  it('does not log a second auto-disable when a concurrent envelope already disabled it', async () => {
    mocks.update.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD + 1 });
    // Another envelope in the same run already flipped the row: the guarded
    // updateMany matches nothing this time.
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      recordEndpointResult('ep-1', { ok: false, code: 'timeout' })
    ).resolves.toBeUndefined();
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
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

  it('records a 429 without bumping the consecutive-failure counter', async () => {
    // A destination's own rate limit is transient by definition. Bumping the
    // counter for it would let ten quota-limited nights auto-disable a
    // destination that never actually failed to deliver.
    await recordEndpointResult('ep-1', { ok: false, code: 'http_429' });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: {
        lastFailureAt: expect.any(Date),
        lastFailureCode: 'http_429',
      },
      select: { consecutiveFailures: true },
    });
    const data = mocks.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty('consecutiveFailures');
  });

  it('never auto-disables from a run of 429s alone, however many', async () => {
    // Simulates AUTO_DISABLE_THRESHOLD consecutive 429s: even though the
    // stored counter itself never advances, this pins that the disable check
    // is skipped for this code, not just coincidentally under threshold.
    mocks.update.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD });

    await recordEndpointResult('ep-1', { ok: false, code: 'http_429' });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});

describe('HealthAccumulator', () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.updateMany.mockReset();
    mocks.pushUpdate.mockReset();
    mocks.pushUpdateMany.mockReset();
    mocks.update.mockResolvedValue({ consecutiveFailures: 1 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.pushUpdate.mockResolvedValue({ consecutiveFailures: 1 });
    mocks.pushUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('flushes exactly one write for two failures against the same endpoint', async () => {
    const health = new HealthAccumulator();

    health.recordEndpoint('ep-1', { ok: false, code: 'timeout' });
    health.recordEndpoint('ep-1', { ok: false, code: 'timeout' });
    await health.flush();

    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it('records a success, not a failure, when one envelope delivered and another failed', async () => {
    const health = new HealthAccumulator();

    health.recordEndpoint('ep-1', { ok: true });
    health.recordEndpoint('ep-1', { ok: false, code: 'timeout' });
    await health.flush();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: { consecutiveFailures: 0, lastSuccessAt: expect.any(Date), lastFailureCode: null },
    });

    // Order must not matter: a failure recorded after the success must not
    // flip the outcome back to failed.
    mocks.update.mockClear();
    const healthReversed = new HealthAccumulator();
    healthReversed.recordEndpoint('ep-1', { ok: false, code: 'timeout' });
    healthReversed.recordEndpoint('ep-1', { ok: true });
    await healthReversed.flush();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'ep-1' },
      data: { consecutiveFailures: 0, lastSuccessAt: expect.any(Date), lastFailureCode: null },
    });
  });

  it('writes distinct destinations independently', async () => {
    const health = new HealthAccumulator();

    health.recordEndpoint('ep-1', { ok: true });
    health.recordEndpoint('ep-2', { ok: false, code: 'dns' });
    health.recordSubscription('sub-1', { ok: false, code: 'http_5xx' });
    await health.flush();

    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.pushUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: expect.objectContaining({ lastFailureCode: 'http_5xx' }),
      select: { consecutiveFailures: true },
    });
  });

  it('does not let one destination write failing abandon the rest of the flush', async () => {
    mocks.update
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ consecutiveFailures: 1 });

    const health = new HealthAccumulator();
    health.recordEndpoint('ep-1', { ok: false, code: 'timeout' });
    health.recordEndpoint('ep-2', { ok: false, code: 'timeout' });

    await expect(health.flush()).resolves.toBeUndefined();
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
});

describe('recordPushSubscriptionResult', () => {
  beforeEach(() => {
    mocks.pushUpdate.mockReset();
    mocks.pushUpdateMany.mockReset();
    mocks.pushUpdate.mockResolvedValue({});
    mocks.pushUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('resets the failure counter on success, clearing autoDisabledAt (no enabled column to strand)', async () => {
    await recordPushSubscriptionResult('sub-1', { ok: true });

    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        consecutiveFailures: 0,
        lastSuccessAt: expect.any(Date),
        lastFailureCode: null,
        autoDisabledAt: null,
      },
    });
  });

  it('atomically increments the counter and records the coarse code on failure', async () => {
    mocks.pushUpdate.mockResolvedValue({ consecutiveFailures: 3 });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'http_5xx' });

    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: {
        consecutiveFailures: { increment: 1 },
        lastFailureCode: 'http_5xx',
      },
      select: { consecutiveFailures: true },
    });
  });

  it('does not disable before the threshold', async () => {
    mocks.pushUpdate.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD - 1 });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'timeout' });

    expect(mocks.pushUpdateMany).not.toHaveBeenCalled();
  });

  it('disables exactly at the threshold, guarded on autoDisabledAt being unset', async () => {
    mocks.pushUpdate.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD });

    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'timeout' });

    expect(mocks.pushUpdateMany).toHaveBeenCalledWith({
      where: { id: 'sub-1', autoDisabledAt: null },
      data: { autoDisabledAt: expect.any(Date) },
    });
  });

  it('does not log a second auto-disable when a concurrent envelope already disabled it', async () => {
    mocks.pushUpdate.mockResolvedValue({ consecutiveFailures: AUTO_DISABLE_THRESHOLD + 1 });
    mocks.pushUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      recordPushSubscriptionResult('sub-1', { ok: false, code: 'timeout' })
    ).resolves.toBeUndefined();
    expect(mocks.pushUpdateMany).toHaveBeenCalledTimes(1);
  });

  it('tolerates a vanished subscription without throwing, on success', async () => {
    mocks.pushUpdate.mockRejectedValue(notFoundError());

    await expect(recordPushSubscriptionResult('gone', { ok: true })).resolves.toBeUndefined();
  });

  it('tolerates a vanished subscription without throwing, on failure', async () => {
    mocks.pushUpdate.mockRejectedValue(notFoundError());

    await expect(
      recordPushSubscriptionResult('gone', { ok: false, code: 'dns' })
    ).resolves.toBeUndefined();
    expect(mocks.pushUpdateMany).not.toHaveBeenCalled();
  });

  it('propagates an unexpected database error rather than swallowing it', async () => {
    mocks.pushUpdate.mockRejectedValue(new Error('connection reset'));

    await expect(recordPushSubscriptionResult('sub-1', { ok: true })).rejects.toThrow(
      'connection reset'
    );
  });

  it('records a 429 without bumping the consecutive-failure counter', async () => {
    await recordPushSubscriptionResult('sub-1', { ok: false, code: 'http_429' });

    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
      data: { lastFailureCode: 'http_429' },
      select: { consecutiveFailures: true },
    });
  });
});
