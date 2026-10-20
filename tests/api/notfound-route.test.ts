import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/logger')>();
  return { ...actual, logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
});

import { GET, POST, PUT, PATCH, DELETE } from '../../app/api/[...notfound]/route';

describe('API catch-all route', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s returns a coded 404 and reports the path in params', async (method, handler) => {
    const request = new Request('http://localhost/api/nope/here', { method });
    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Not Found');
    expect(body.code).toBe('not_found');
    expect(body.params).toEqual({ path: '/api/nope/here' });
  });
});
