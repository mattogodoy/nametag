import { describe, it, expect } from 'vitest';
import { runWithContext, updateContext, getContext } from '@/lib/logging/context';

describe('logging context', () => {
  it('returns undefined outside a scope', () => {
    expect(getContext()).toBeUndefined();
  });

  it('runWithContext populates the store with an auto-generated requestId', () => {
    runWithContext({}, () => {
      const ctx = getContext();
      expect(ctx).toBeDefined();
      expect(ctx!.requestId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('accepts an explicit requestId', () => {
    runWithContext({ requestId: 'req-123' }, () => {
      expect(getContext()!.requestId).toBe('req-123');
    });
  });

  it('nests scopes and inherits parent fields', () => {
    runWithContext({ requestId: 'outer', userId: 'u-1' }, () => {
      runWithContext({ jobId: 'j-1' }, () => {
        const ctx = getContext()!;
        expect(ctx.requestId).toBe('outer');
        expect(ctx.userId).toBe('u-1');
        expect(ctx.jobId).toBe('j-1');
      });
    });
  });

  it('child scope can override parent requestId', () => {
    runWithContext({ requestId: 'outer' }, () => {
      runWithContext({ requestId: 'inner' }, () => {
        expect(getContext()!.requestId).toBe('inner');
      });
    });
  });

  it('updateContext mutates only the current scope', () => {
    runWithContext({ requestId: 'a' }, () => {
      updateContext({ userId: 'u-7' });
      expect(getContext()!.userId).toBe('u-7');

      runWithContext({ requestId: 'b' }, () => {
        expect(getContext()!.userId).toBe('u-7'); // inherited
        updateContext({ userId: 'u-9' });
        expect(getContext()!.userId).toBe('u-9');
      });

      expect(getContext()!.userId).toBe('u-7'); // outer untouched
    });
  });

  it('updateContext outside a scope is a no-op', () => {
    expect(() => updateContext({ userId: 'ignored' })).not.toThrow();
    expect(getContext()).toBeUndefined();
  });

  it('propagates across async boundaries', async () => {
    await runWithContext({ requestId: 'async-1' }, async () => {
      await Promise.resolve();
      await new Promise((r) => setImmediate(r));
      expect(getContext()!.requestId).toBe('async-1');
    });
  });
});
