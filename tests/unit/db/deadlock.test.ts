import { describe, it, expect, vi } from 'vitest';
import { isDeadlock, withDeadlockRetry } from '@/lib/db/deadlock';

// The shape @prisma/adapter-pg throws for a Postgres deadlock.
const deadlock = Object.assign(new Error('deadlock detected'), {
  cause: { kind: 'postgres', code: '40P01', originalCode: '40P01' },
});

describe('isDeadlock', () => {
  it('recognises a deadlock wrapped by the driver adapter or raw', () => {
    expect(isDeadlock(deadlock)).toBe(true);
    expect(isDeadlock({ code: '40P01' })).toBe(true);
  });

  it('rejects other errors', () => {
    expect(isDeadlock(new Error('x'))).toBe(false);
    expect(isDeadlock({ cause: { code: '23505' } })).toBe(false);
    expect(isDeadlock(null)).toBe(false);
  });
});

describe('withDeadlockRetry', () => {
  it('runs again after a deadlock and returns the result', async () => {
    const fn = vi.fn().mockRejectedValueOnce(deadlock).mockResolvedValue('ok');
    await expect(withDeadlockRetry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives up after three attempts', async () => {
    const fn = vi.fn().mockRejectedValue(deadlock);
    await expect(withDeadlockRetry(fn)).rejects.toBe(deadlock);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const other = new Error('boom');
    const fn = vi.fn().mockRejectedValue(other);
    await expect(withDeadlockRetry(fn)).rejects.toBe(other);
    expect(fn).toHaveBeenCalledOnce();
  });
});
