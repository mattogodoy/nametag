import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enqueueGeocodeRequest, resetGeocodeQueueForTests } from '../../lib/geocoding/queue';

describe('enqueueGeocodeRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetGeocodeQueueForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs tasks serially with at least 1s between them', async () => {
    const startTimes: number[] = [];
    const task = () => {
      startTimes.push(Date.now());
      return Promise.resolve('ok');
    };

    const first = enqueueGeocodeRequest(task);
    const second = enqueueGeocodeRequest(task);

    await vi.advanceTimersByTimeAsync(0);
    expect(startTimes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1099);
    expect(startTimes).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(startTimes).toHaveLength(2);
    expect(startTimes[1] - startTimes[0]).toBeGreaterThanOrEqual(1100);

    await expect(first).resolves.toBe('ok');
    await expect(second).resolves.toBe('ok');
  });

  it('keeps processing after a task rejects', async () => {
    const failing = enqueueGeocodeRequest(() => Promise.reject(new Error('boom')));
    const following = enqueueGeocodeRequest(() => Promise.resolve(42));

    await vi.advanceTimersByTimeAsync(2000);

    await expect(failing).rejects.toThrow('boom');
    await expect(following).resolves.toBe(42);
  });
});
