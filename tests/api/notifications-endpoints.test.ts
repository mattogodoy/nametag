import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  encryptSecret: vi.fn(),
  checkRateLimit: vi.fn(),
  resolveTarget: vi.fn(),
  sendNtfy: vi.fn(),
  recordEndpointResult: vi.fn(),
  getUserLocale: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({ auth: mocks.auth }));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    notificationEndpoint: {
      findMany: mocks.findMany,
      count: mocks.count,
      create: mocks.create,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));

vi.mock('../../lib/crypto/secrets', () => ({
  encryptSecret: mocks.encryptSecret,
  decryptSecret: vi.fn(),
}));

vi.mock('../../lib/rate-limit', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/rate-limit')>('../../lib/rate-limit');
  return {
    ...actual,
    checkRateLimit: mocks.checkRateLimit,
  };
});

vi.mock('../../lib/net/url-validation', async () => {
  const actual = await vi.importActual<typeof import('../../lib/net/url-validation')>(
    '../../lib/net/url-validation'
  );
  return { ...actual, resolveTarget: mocks.resolveTarget };
});

vi.mock('../../lib/notifications/channels/ntfy', async () => {
  const actual = await vi.importActual<typeof import('../../lib/notifications/channels/ntfy')>(
    '../../lib/notifications/channels/ntfy'
  );
  return { ...actual, sendNtfy: mocks.sendNtfy };
});

vi.mock('../../lib/notifications/endpoint-health', async () => {
  const actual = await vi.importActual<
    typeof import('../../lib/notifications/endpoint-health')
  >('../../lib/notifications/endpoint-health');
  return { ...actual, recordEndpointResult: mocks.recordEndpointResult };
});

vi.mock('../../lib/locale', () => ({ getUserLocale: mocks.getUserLocale }));

import { GET, POST } from '../../app/api/notifications/endpoints/route';
import {
  PUT as updateEndpoint,
  DELETE as deleteEndpoint,
} from '../../app/api/notifications/endpoints/[id]/route';
import { POST as testEndpoint } from '../../app/api/notifications/endpoints/[id]/test/route';

/** Next passes route params as a promise. */
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function jsonRequest(url: string, body?: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function post(body: unknown): Request {
  return new Request('http://localhost/api/notifications/endpoints', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const valid = { type: 'NTFY', label: 'Phone', url: 'https://ntfy.sh/my-topic' };

/** Fetching the list needs no body, but withAuth's logging wrapper always reads request.method. */
function listRequest(): Request {
  return new Request('http://localhost/api/notifications/endpoints');
}

// Reset and default every mock before each test in the whole file, not just
// the first describe block. beforeEach only cascades to nested describes, so
// leaving this inside 'endpoints API' left the two sibling describe blocks
// below running against whatever checkRateLimit/sendNtfy state the previous
// test happened to leave behind.
beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  mocks.count.mockResolvedValue(0);
  mocks.create.mockResolvedValue({ id: 'ep-1', ...valid, secret: null, enabled: true });
  mocks.findMany.mockResolvedValue([]);
  mocks.encryptSecret.mockReturnValue('encrypted');
  mocks.checkRateLimit.mockReturnValue(null);
  mocks.resolveTarget.mockResolvedValue({
    parsed: new URL('https://ntfy.sh/my-topic'),
    address: '1.2.3.4',
    family: 4,
    port: 443,
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  mocks.findFirst.mockResolvedValue({
    id: 'ep-1',
    type: 'NTFY',
    url: 'https://ntfy.sh/my-topic',
    secret: null,
  });
  mocks.sendNtfy.mockResolvedValue({ ok: true });
  mocks.getUserLocale.mockResolvedValue('en');
});

describe('endpoints API', () => {
  it('rejects unauthenticated access', async () => {
    mocks.auth.mockResolvedValue(null);

    expect((await POST(post(valid))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('creates an ntfy endpoint', async () => {
    expect((await POST(post(valid))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
  });

  it('validates the URL against SSRF policy before storing it', async () => {
    mocks.resolveTarget.mockRejectedValue(new Error('Internal addresses are not allowed'));

    const response = await POST(post({ ...valid, url: 'https://internal.test/topic' }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects a topic URL with no topic segment', async () => {
    const response = await POST(post({ ...valid, url: 'https://ntfy.sh/' }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('encrypts the access token and never stores it in the clear', async () => {
    await POST(post({ ...valid, token: 'tk_secret' }));

    expect(mocks.encryptSecret).toHaveBeenCalledWith('tk_secret');
    expect(mocks.create.mock.calls[0][0].data.secret).toBe('encrypted');
    expect(JSON.stringify(mocks.create.mock.calls[0][0])).not.toContain('tk_secret');
  });

  it('enforces the per-user endpoint cap', async () => {
    mocks.count.mockResolvedValue(5);

    const response = await POST(post(valid));

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('applies a rate limit to creation', async () => {
    mocks.checkRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );

    expect((await POST(post(valid))).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('never returns the stored secret when listing', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'ep-1', type: 'NTFY', label: 'Phone', url: 'https://ntfy.sh/t', enabled: true,
        consecutiveFailures: 0, lastSuccessAt: null, lastFailureAt: null, lastFailureCode: null,
        autoDisabledAt: null, createdAt: new Date() },
    ]);

    const body = await (await GET(listRequest())).json();

    expect(JSON.stringify(body)).not.toContain('secret');
    expect(mocks.findMany.mock.calls[0][0].select.secret).toBeUndefined();
  });

  it('scopes the list to the signed-in user', async () => {
    await GET(listRequest());

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });
});

describe('endpoint item API', () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('scopes an update to the signed-in user', async () => {
    // Dropping userId here would let any signed-in user relabel or re-enable
    // another account's endpoint, so the where clause is asserted exactly.
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { label: 'New' }),
      ctx('ep-1')
    );

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ep-1', userId: 'user-1' } })
    );
  });

  it('clears the auto-disable state when re-enabling', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { enabled: true }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({
      enabled: true,
      autoDisabledAt: null,
      consecutiveFailures: 0,
      lastFailureCode: null,
    });
  });

  it('does not reset the counter when disabling', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { enabled: false }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).toEqual({ enabled: false });
  });

  it('returns 404 when the update matches nothing', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { label: 'New' }),
      ctx('ep-1')
    );

    expect(response.status).toBe(404);
  });

  it('scopes a delete to the signed-in user', async () => {
    await deleteEndpoint(
      new Request('http://localhost/api/notifications/endpoints/ep-1', { method: 'DELETE' }),
      ctx('ep-1')
    );

    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: 'ep-1', userId: 'user-1' },
    });
  });

  it('returns 404 when the delete matches nothing', async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });

    const response = await deleteEndpoint(
      new Request('http://localhost/api/notifications/endpoints/ep-1', { method: 'DELETE' }),
      ctx('ep-1')
    );

    expect(response.status).toBe(404);
  });
});

describe('endpoint test-send API', () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('scopes the lookup to the signed-in user', async () => {
    await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ep-1', userId: 'user-1' } })
    );
  });

  it('returns 404 for an endpoint the user does not own', async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(response.status).toBe(404);
    expect(mocks.sendNtfy).not.toHaveBeenCalled();
  });

  it('is rate limited before any outbound request is made', async () => {
    mocks.checkRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(response.status).toBe(429);
    expect(mocks.sendNtfy).not.toHaveBeenCalled();
  });

  it('records a successful test', async () => {
    await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(mocks.recordEndpointResult).toHaveBeenCalledWith('ep-1', { ok: true });
  });

  it('does not count a failed test toward auto-disable', async () => {
    mocks.sendNtfy.mockResolvedValue({ ok: false, code: 'timeout' });

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    // The user is debugging their receiver. Recording this would eventually
    // switch the endpoint off underneath them.
    expect(mocks.recordEndpointResult).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: false, code: 'timeout' });
  });
});
