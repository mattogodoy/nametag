import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Shared capture store — hoisted so the mock factory can reference it.
const lines = vi.hoisted<Record<string, unknown>[]>(() => []);

vi.mock('@/lib/logger', async () => {
  const { Writable } = await import('node:stream');
  const { default: pino } = await import('pino');

  const actual = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

  const stream = new Writable({
    write(c: Buffer, _e: BufferEncoding, cb: () => void) {
      lines.push(JSON.parse(c.toString()) as Record<string, unknown>);
      cb();
    },
  });

  const capturedLogger = pino({ ...actual.pinoOptions, transport: undefined }, stream);

  return {
    ...actual,
    logger: capturedLogger,
    createModuleLogger: (m: string) => capturedLogger.child({ module: m }),
  };
});

beforeEach(() => { lines.length = 0; });

describe('request correlation end-to-end', () => {
  it('HTTP request + downstream module logs share requestId', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { createModuleLogger } = await import('@/lib/logger');
    const cdav = createModuleLogger('carddav');

    const handler = withLogging(async () => {
      cdav.info({ personId: 'p-1' }, 'doing CardDAV work');
      return NextResponse.json({ ok: true });
    });

    await handler(new Request('https://example.com/api/whatever', { method: 'GET' }));

    const http = lines.find((l) => l.event === 'http.request.completed');
    const inner = lines.find((l) => l.msg === 'doing CardDAV work');
    expect(http).toBeDefined();
    expect(inner).toBeDefined();
    expect(http!.requestId).toBe(inner!.requestId);
    expect(inner!.personId).toBe('p-1');
    expect(inner!.module).toBe('carddav');
  });

  it('fire-and-forget background work inside a handler inherits the requestId', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { createModuleLogger } = await import('@/lib/logger');
    const bg = createModuleLogger('background');

    const handler = withLogging(async () => {
      void (async () => {
        await new Promise((r) => setImmediate(r));
        bg.info('async after response');
      })();
      return NextResponse.json({ ok: true });
    });

    await handler(new Request('https://example.com/api/fnf', { method: 'POST' }));
    // Let the microtask complete
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    const http = lines.find((l) => l.event === 'http.request.completed');
    const bgLine = lines.find((l) => l.msg === 'async after response');
    expect(http!.requestId).toBe(bgLine!.requestId);
  });
});
