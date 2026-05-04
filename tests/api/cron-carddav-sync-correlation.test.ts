import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared capture store — hoisted so the mock factory can reference it.
const capturedLines = vi.hoisted<Record<string, unknown>[]>(() => []);

vi.mock('@/lib/logger', async () => {
  const { Writable } = await import('node:stream');
  const { default: pino } = await import('pino');

  const actual = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

  const stream = new Writable({
    write(c: Buffer, _e: BufferEncoding, cb: () => void) {
      capturedLines.push(JSON.parse(c.toString()) as Record<string, unknown>);
      cb();
    },
  });

  const log = pino({ ...actual.pinoOptions, transport: undefined }, stream);

  return {
    ...actual,
    logger: log,
    createModuleLogger: (m: string) => log.child({ module: m }),
    __capturedLines: capturedLines,
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findMany: vi.fn(async () => [
        { id: 'c-1', userId: 'u-1', autoSyncInterval: 0, lastSyncAt: null },
        { id: 'c-2', userId: 'u-2', autoSyncInterval: 0, lastSyncAt: null },
      ]),
      update: vi.fn(async () => ({})),
    },
    cronJobLog: {
      create: vi.fn(async () => ({ id: 'log-1' })),
      update: vi.fn(async () => ({})),
    },
  },
}));

vi.mock('@/lib/carddav/sync', () => ({
  bidirectionalSync: vi.fn(async () => ({
    imported: 0, exported: 0, updatedLocally: 0, updatedRemotely: 0,
    conflicts: 0, errors: 0, errorMessages: [], pendingImports: 0,
  })),
}));

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'secret' } }));

beforeEach(() => { capturedLines.length = 0; });

describe('cron carddav-sync correlation', () => {
  it('emits cron.carddav.started and cron.carddav.finished sharing a jobId', async () => {
    const { GET } = await import('@/app/api/cron/carddav-sync/route');
    await GET(new Request('https://example.com/api/cron/carddav-sync', {
      headers: { authorization: 'Bearer secret' },
    }));

    const started = capturedLines.find((l) => l.event === 'cron.carddav.started');
    const finished = capturedLines.find((l) => l.event === 'cron.carddav.finished');
    expect(started).toBeDefined();
    expect(finished).toBeDefined();
    expect(started!.jobId).toBeDefined();
    expect(started!.jobId).toBe(finished!.jobId);
  });

  it('each per-user iteration has a distinct requestId but the same jobId', async () => {
    const { GET } = await import('@/app/api/cron/carddav-sync/route');
    await GET(new Request('https://example.com/api/cron/carddav-sync', {
      headers: { authorization: 'Bearer secret' },
    }));

    const iterations = capturedLines.filter(
      (l) => l.userId && typeof l.userId === 'string' && l.requestId && l.jobId,
    );
    // Two mocked users — expect at least one log per user
    const byUser = new Set(iterations.map((l) => l.userId));
    expect(byUser.size).toBe(2);

    const byRequestId = new Set(iterations.map((l) => l.requestId));
    expect(byRequestId.size).toBe(2); // different requestId per iteration

    const byJobId = new Set(iterations.map((l) => l.jobId));
    expect(byJobId.size).toBe(1); // shared jobId
  });
});
