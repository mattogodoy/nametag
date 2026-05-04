import { describe, it, expect, vi } from 'vitest';
import { NextResponse } from 'next/server';

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

  // Build a real pino instance with the project's pinoOptions (which includes the
  // ALS mixin), but override the transport so output goes to our stream.
  const log = pino({ ...actual.pinoOptions, transport: undefined }, stream);

  return {
    ...actual,
    logger: log,
    createModuleLogger: (_m: string) => log.child({ module: _m }),
    __capturedLines: capturedLines,
  };
});

describe('withLogging (request correlation)', () => {
  it('emits http.request.completed with a requestId that all handler logs share', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { createModuleLogger, __capturedLines } = (await import('@/lib/logger')) as typeof import('@/lib/logger') & { __capturedLines: Record<string, unknown>[] };
    const modLog = createModuleLogger('testmod');

    // Clear lines before test
    __capturedLines.length = 0;

    const handler = withLogging(async (_req: Request) => {
      modLog.info({ foo: 'bar' }, 'inside handler');
      return NextResponse.json({ ok: true });
    });

    await handler(new Request('https://example.com/api/thing', { method: 'GET' }));

    const inner = __capturedLines.find((l) => l.msg === 'inside handler');
    const http = __capturedLines.find((l) => l.event === 'http.request.completed');
    expect(inner).toBeDefined();
    expect(http).toBeDefined();
    expect(inner!.requestId).toBeDefined();
    expect(inner!.requestId).toBe(http!.requestId);
    expect(http!.method).toBe('GET');
    expect(http!.path).toBe('/api/thing');
    expect(http!.status).toBe(200);
  });

  it('emits http.request.failed when handler throws', async () => {
    const { withLogging } = await import('@/lib/api-utils');
    const { __capturedLines } = (await import('@/lib/logger')) as typeof import('@/lib/logger') & { __capturedLines: Record<string, unknown>[] };

    // Clear lines before test
    __capturedLines.length = 0;

    const handler = withLogging(async () => { throw new Error('boom'); });

    await expect(handler(new Request('https://example.com/api/broken', { method: 'POST' }))).rejects.toThrow('boom');

    const failed = __capturedLines.find((l) => l.event === 'http.request.failed');
    expect(failed).toBeDefined();
    expect(failed!.status).toBe(500);
    expect((failed!.err as Record<string, unknown>).message).toBe('boom');
  });
});
