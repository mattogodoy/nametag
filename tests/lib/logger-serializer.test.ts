import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { Writable } from 'node:stream';
import { AppError, ExternalServiceError } from '@/lib/errors';
import { runWithContext } from '@/lib/logging/context';

// Import the exported options so we can replay them against a captured stream.
// If logger.ts does not export pinoOptions, export it (see implementation step).
import { pinoOptions } from '@/lib/logger';

function captureLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(chunk.toString()));
      cb();
    },
  });
  const logger = pino({ ...pinoOptions, transport: undefined }, stream);
  return { logger, lines };
}

describe('logger integration', () => {
  it('enriches log records with the current ALS context', () => {
    const { logger, lines } = captureLogger();
    runWithContext({ requestId: 'req-1', userId: 'u-1' }, () => {
      logger.info('hello');
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].requestId).toBe('req-1');
    expect(lines[0].userId).toBe('u-1');
  });

  it('omits context fields outside a scope', () => {
    const { logger, lines } = captureLogger();
    logger.info('no scope');
    expect(lines[0].requestId).toBeUndefined();
  });

  it('flattens ExternalServiceError fields onto the log record', () => {
    const { logger, lines } = captureLogger();
    const err = new ExternalServiceError({
      message: 'CardDAV UPDATE failed: 400 Bad Request',
      service: 'carddav',
      endpoint: 'https://carddav.example/contacts/x.vcf',
      method: 'PUT',
      status: 400,
      body: '<error>bad property</error>',
      context: { personId: 'p-1' },
    });
    logger.error({ err }, 'push failed');

    expect(lines[0].err).toMatchObject({
      type: expect.stringMatching(/Error/),
      code: 'carddav_error',
      statusCode: 400,
      service: 'carddav',
      endpoint: 'https://carddav.example/contacts/x.vcf',
      method: 'PUT',
      status: 400,
      body: '<error>bad property</error>',
      personId: 'p-1',
    });
  });

  it('flattens plain AppError fields onto the log record', () => {
    const { logger, lines } = captureLogger();
    const err = new AppError('validation failed', {
      code: 'validation',
      context: { field: 'email' },
    });
    logger.error({ err }, 'rejected');
    expect(lines[0].err).toMatchObject({
      code: 'validation',
      field: 'email',
    });
  });

  it('serializes plain Error objects with stdSerializer shape', () => {
    const { logger, lines } = captureLogger();
    logger.error({ err: new Error('oops') }, 'plain');
    // pino.stdSerializers.err produces { type, message, stack }
    expect(lines[0].err).toMatchObject({ message: 'oops' });
    expect(lines[0].err).toHaveProperty('stack');
  });

  it('child logger bindings win over mixin on colliding keys', () => {
    const { logger, lines } = captureLogger();
    runWithContext({ requestId: 'req-1', module: 'from-context' }, () => {
      const child = logger.child({ module: 'carddav' });
      child.info('x');
    });
    expect(lines[0].module).toBe('carddav');
    expect(lines[0].requestId).toBe('req-1');
  });

  it('explicit record fields win over mixin on colliding keys', () => {
    const { logger, lines } = captureLogger();
    runWithContext({ requestId: 'req-1' }, () => {
      logger.info({ requestId: 'override' }, 'y');
    });
    expect(lines[0].requestId).toBe('override');
  });

  it('err.context keys do not overwrite core err fields like code or stack', () => {
    const { logger, lines } = captureLogger();
    const err = new AppError('boom', { code: 'real_code', context: { code: 'fake', stack: 'fake' } });
    logger.error({ err }, 'test');
    const errRecord = lines[0].err as Record<string, unknown>;
    expect(errRecord.code).toBe('real_code');
    expect(typeof errRecord.stack).toBe('string');
    expect(errRecord.stack).not.toBe('fake');
  });
});
