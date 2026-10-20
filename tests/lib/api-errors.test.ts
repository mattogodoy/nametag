import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { API_ERRORS, apiError, genericCodeFor, validationFailed, zodIssuesToFields } from '@/lib/api-errors';

describe('apiError', () => {
  it('takes the status from the catalog and includes params', async () => {
    const res = apiError('photo_too_large', 'Photo exceeds maximum size of 10MB', { maxBytes: 10485760 });
    expect(res.status).toBe(API_ERRORS.photo_too_large.status);
    expect(await res.json()).toEqual({
      error: 'Photo exceeds maximum size of 10MB',
      code: 'photo_too_large',
      params: { maxBytes: 10485760 },
    });
  });
  it('omits params when not given and keeps headers', async () => {
    const res = apiError('rate_limited', 'Too many', undefined, { headers: { 'Retry-After': '30' } });
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(await res.json()).toEqual({ error: 'Too many', code: 'rate_limited' });
  });
});

describe('genericCodeFor', () => {
  it.each([
    [400, 'bad_request'], [401, 'unauthorized'], [403, 'forbidden'], [404, 'not_found'],
    [409, 'conflict'], [413, 'payload_too_large'], [429, 'rate_limited'], [500, 'internal_error'],
    [503, 'service_unavailable'], [408, 'bad_request'], [502, 'internal_error'],
  ])('%i -> %s', (status, code) => {
    expect(genericCodeFor(status)).toBe(code);
  });
});

describe('zodIssuesToFields', () => {
  const schema = z.object({
    name: z.string().min(2).max(5),
    email: z.email(),
    kind: z.enum(['a', 'b']),
    phones: z.array(z.object({ number: z.string().max(3) })),
  }).refine(() => false, { message: 'root' });

  it('maps each issue kind with path and params', () => {
    const r = schema.safeParse({ name: 'x', email: 'nope', kind: 'c', phones: [{ number: 'toolong' }] });
    expect(r.success).toBe(false);
    if (r.success) return;
    const fields = zodIssuesToFields(r.error.issues);
    expect(fields).toContainEqual({ path: 'name', issue: 'too_short', params: { min: 2 } });
    expect(fields).toContainEqual({ path: 'email', issue: 'invalid_format' });
    expect(fields).toContainEqual({ path: 'kind', issue: 'invalid_value' });
    expect(fields).toContainEqual({ path: 'phones.0.number', issue: 'too_long', params: { max: 3 } });
  });
  it('maps a missing field to required and a root refine to an empty path', () => {
    const r = z.object({ name: z.string() }).refine(() => false).safeParse({});
    if (r.success) throw new Error('expected failure');
    expect(zodIssuesToFields(r.error.issues)).toContainEqual({ path: 'name', issue: 'required' });
    const r2 = z.object({}).refine(() => false).safeParse({});
    if (r2.success) throw new Error('expected failure');
    expect(zodIssuesToFields(r2.error.issues)).toEqual([{ path: '', issue: 'invalid_value' }]);
  });
});

describe('validationFailed', () => {
  const failure = z.object({ name: z.string() }).safeParse({});
  if (failure.success) throw new Error('expected failure');
  const issues = failure.error.issues;

  it('defaults the message and derives details from the issues', async () => {
    const res = validationFailed(issues);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Validation failed',
      code: 'validation_failed',
      details: [{ field: 'name', message: issues[0].message }],
      fields: [{ path: 'name', issue: 'required' }],
    });
  });

  it('uses a custom message and caller-supplied details verbatim', async () => {
    const body = await validationFailed(issues, 'Invalid input', issues).json();
    expect(body.error).toBe('Invalid input');
    expect(body.details).toEqual(JSON.parse(JSON.stringify(issues)));
    expect(body.fields).toEqual([{ path: 'name', issue: 'required' }]);
  });
});
