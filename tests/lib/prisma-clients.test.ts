import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The soft-delete-bypassing client used by the trash, restore, and purge paths
 * must be a shared singleton, like `prisma` itself.
 *
 * It used to be produced by a `withDeleted()` factory that constructed a fresh
 * PrismaClient (and therefore a fresh pg Pool) on every call, which every
 * caller then had to tear down in a `finally` block. That meant a TCP connect
 * and auth handshake on each trash listing, restore, and permanent delete, and
 * one forgotten `finally` would have leaked a pool.
 */

const constructed = vi.hoisted(() => ({ prismaClient: 0, adapter: 0 }));

vi.mock('@prisma/client', () => {
  class FakePrismaClient {
    constructor() {
      constructed.prismaClient++;
    }
    $extends() {
      return this;
    }
    $disconnect() {
      return Promise.resolve();
    }
    $on() {}
  }
  return { PrismaClient: FakePrismaClient, Prisma: {} };
});

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor() {
      constructed.adapter++;
    }
  },
}));

describe('Prisma client singletons', () => {
  beforeEach(() => {
    constructed.prismaClient = 0;
    constructed.adapter = 0;
    vi.resetModules();
  });

  it('constructs each client once per module load, not once per use', async () => {
    const mod = await import('@/lib/prisma');

    const afterLoad = constructed.prismaClient;

    // Touch the unfiltered client repeatedly: no further clients may appear.
    for (let i = 0; i < 25; i++) {
      expect(mod.prismaIncludingDeleted).toBeDefined();
    }

    expect(constructed.prismaClient).toBe(afterLoad);
    expect(afterLoad).toBeLessThanOrEqual(2);
  });

  it('hands out the same unfiltered client every time', async () => {
    const mod = await import('@/lib/prisma');

    expect(mod.prismaIncludingDeleted).toBe(mod.prismaIncludingDeleted);

    const again = await import('@/lib/prisma');
    expect(again.prismaIncludingDeleted).toBe(mod.prismaIncludingDeleted);
  });

  it('no longer exports a per-call factory', async () => {
    const mod = (await import('@/lib/prisma')) as Record<string, unknown>;

    // A factory invites the caller to own a lifecycle it should not own.
    expect(mod.withDeleted).toBeUndefined();
  });
});
