import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../../../lib/notifications/concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in input order, not completion order', async () => {
    const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it('never runs more than `limit` tasks at once', async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });

    expect(peak).toBe(3);
  });

  it('passes the index to the callback', async () => {
    const seen: number[] = [];
    await mapWithConcurrency(['a', 'b', 'c'], 1, async (_item, index) => {
      seen.push(index);
    });

    expect(seen).toEqual([0, 1, 2]);
  });

  it('returns an empty array for empty input without calling the callback', async () => {
    let calls = 0;
    const result = await mapWithConcurrency([], 5, async () => {
      calls++;
    });

    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it('rejects when the callback rejects', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      })
    ).rejects.toThrow('boom');
  });
});
