import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

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
  probeNtfyHealth: vi.fn(),
}));

// Built inside vi.hoisted so the vi.mock factory below, which is hoisted to
// the top of the file, can close over it without a temporal-dead-zone error.
const prismaMock = vi.hoisted(() => {
  const client = {
    notificationEndpoint: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return client;
});

vi.mock('../../lib/auth', () => ({ auth: mocks.auth }));

// The create path runs its authoritative cap check and its insert inside one
// transaction, behind a row lock on the owning user (see lib/db/user-lock.ts).
// $transaction hands the callback this same object, so a test asserting on
// the create delegate still sees the call.
vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('../../lib/db/user-lock', () => ({ lockUserRow: vi.fn() }));

vi.mock('../../lib/notifications/outbound', async () => {
  const actual = await vi.importActual<typeof import('../../lib/notifications/outbound')>(
    '../../lib/notifications/outbound'
  );
  return { ...actual, probeNtfyHealth: mocks.probeNtfyHealth };
});

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

const webhookMocks = vi.hoisted(() => ({
  canUseWebhooks: vi.fn(),
  generateWebhookSecret: vi.fn(),
  sendWebhook: vi.fn(),
}));

vi.mock('../../lib/notifications/entitlements', () => ({
  canUseWebhooks: webhookMocks.canUseWebhooks,
}));
vi.mock('../../lib/notifications/signature', () => ({
  generateWebhookSecret: webhookMocks.generateWebhookSecret,
  signPayload: vi.fn(),
}));
vi.mock('../../lib/notifications/channels/webhook', () => ({
  sendWebhook: webhookMocks.sendWebhook,
}));

import { outboundPolicy } from '../../lib/net/url-validation';
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
  Object.values(prismaMock.notificationEndpoint).forEach((m) => m.mockReset());
  prismaMock.$queryRaw.mockReset();
  prismaMock.$transaction.mockReset();
  mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  // The route reaches the delegates through the prisma mock; these aliases
  // are what the assertions below are written against, so keep them the
  // same function objects rather than two parallel sets of spies.
  mocks.count = prismaMock.notificationEndpoint.count;
  mocks.create = prismaMock.notificationEndpoint.create;
  mocks.findMany = prismaMock.notificationEndpoint.findMany;
  mocks.findFirst = prismaMock.notificationEndpoint.findFirst;
  mocks.updateMany = prismaMock.notificationEndpoint.updateMany;
  mocks.deleteMany = prismaMock.notificationEndpoint.deleteMany;
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
    enabled: true,
  });
  mocks.sendNtfy.mockResolvedValue({ ok: true });
  mocks.getUserLocale.mockResolvedValue('en');
  mocks.probeNtfyHealth.mockResolvedValue('ntfy');
  prismaMock.$transaction.mockImplementation(
    (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock)
  );
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

    // Pins which policy is used, not just that resolveTarget was called.
    // Swapping outboundPolicy() for a hardcoded permissive policy would
    // otherwise leave every other assertion in this file green.
    expect(mocks.resolveTarget).toHaveBeenCalledWith(valid.url, outboundPolicy());
  });

  it('stores the normalised form of the URL, not the URL as typed', async () => {
    // https://NTFY.sh/my-topic/ and https://ntfy.sh/my-topic point at the
    // same topic. @@unique([userId, url]) compares raw strings, so storing
    // the input verbatim would let a user register the same topic three
    // times over (case, trailing slash), tripling every reminder and
    // consuming three of five endpoint slots for one destination.
    const response = await POST(post({ ...valid, url: 'https://NTFY.sh/my-topic/' }));

    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.url).toBe('https://ntfy.sh/my-topic');
    expect(mocks.resolveTarget).toHaveBeenCalledWith('https://ntfy.sh/my-topic', outboundPolicy());
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
    // Create is the one route that handles the secret. Pinning its select
    // to PUBLIC_FIELDS means dropping the select (or widening it to include
    // `secret`) fails here rather than silently returning the encrypted
    // value and the owning userId in the 201 body.
    expect(mocks.create.mock.calls[0][0].select).toEqual({
      id: true,
      type: true,
      label: true,
      url: true,
      enabled: true,
      consecutiveFailures: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureCode: true,
      autoDisabledAt: true,
      createdAt: true,
    });
  });

  it('enforces the per-user endpoint cap', async () => {
    mocks.count.mockResolvedValue(5);

    const response = await POST(post(valid));

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    // count({ where: {} }) would still satisfy every assertion above while
    // turning a per-user cap into an instance-wide one, bricking every
    // signup after the fifth endpoint anywhere on the instance.
    expect(mocks.count).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });

  it('reports a duplicate URL as a 409 distinct from the per-user cap', async () => {
    // @@unique([userId, url]) is what actually stops the same topic being
    // added five times; the count check above only guards the cap. A client
    // needs to tell the two 409s apart to show the right message, so the
    // `code` here matters as much as the status.
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const response = await POST(post(valid));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'duplicate' });
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

describe('webhook endpoint creation', () => {
  const webhook = { type: 'WEBHOOK', label: 'Home Assistant', url: 'https://hooks.test/nametag' };

  beforeEach(() => {
    webhookMocks.canUseWebhooks.mockReset();
    webhookMocks.generateWebhookSecret.mockReset();
    webhookMocks.canUseWebhooks.mockResolvedValue(true);
    webhookMocks.generateWebhookSecret.mockReturnValue('f'.repeat(64));
    mocks.create.mockResolvedValue({
      id: 'ep-1',
      type: 'WEBHOOK',
      label: 'Home Assistant',
      url: 'https://hooks.test/nametag',
      enabled: true,
    });
  });

  it('creates a webhook for an entitled user', async () => {
    expect((await POST(post(webhook))).status).toBe(201);
  });

  it('refuses a user who is not entitled', async () => {
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    expect((await POST(post(webhook))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('generates the secret server-side and ignores any the client sends', async () => {
    await POST(post({ ...webhook, secret: 'attacker-chosen' }));

    expect(webhookMocks.generateWebhookSecret).toHaveBeenCalled();
    expect(mocks.encryptSecret).toHaveBeenCalledWith('f'.repeat(64));
    expect(JSON.stringify(mocks.create.mock.calls[0][0])).not.toContain('attacker-chosen');
  });

  it('returns the secret exactly once, at creation', async () => {
    const body = await (await POST(post(webhook))).json();

    expect(body.secret).toBe('f'.repeat(64));
  });

  it('never returns the secret afterwards', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'ep-1', type: 'WEBHOOK', label: 'HA', url: 'https://hooks.test/x', enabled: true,
        consecutiveFailures: 0, lastSuccessAt: null, lastFailureAt: null, lastFailureCode: null,
        autoDisabledAt: null, createdAt: new Date() },
    ]);

    // The plan this replaced asserted this against a mocked row that never
    // carried a secret in the first place, so it would have passed no matter
    // what the route selected. Assert on the select the route actually sends
    // to Prisma instead, the way "encrypts the access token and never stores
    // it in the clear" (earlier in this file) already does for PUBLIC_FIELDS
    // on create: this is the same invariant, pinned on the list route.
    await (await GET(listRequest())).json();

    expect(mocks.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      type: true,
      label: true,
      url: true,
      enabled: true,
      consecutiveFailures: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      lastFailureCode: true,
      autoDisabledAt: true,
      createdAt: true,
    });
  });

  it('does not generate a secret for an ntfy endpoint', async () => {
    await POST(post(valid));

    expect(webhookMocks.generateWebhookSecret).not.toHaveBeenCalled();
  });

  it('applies SSRF validation to webhook URLs too', async () => {
    mocks.resolveTarget.mockRejectedValue(new Error('Internal addresses are not allowed'));

    expect((await POST(post({ ...webhook, url: 'https://internal.test/x' }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('normalises a webhook URL by scheme and host only, preserving path and query', async () => {
    // Unlike an ntfy topic URL, a webhook's path and query string are part of
    // its identity. This fixture is deliberately multi-segment with a query
    // string: a naive implementation that reused parseNtfyUrl (which only
    // accepts exactly one path segment) would pass a single-segment fixture
    // like the `webhook` constant above while mangling or rejecting this one.
    const response = await POST(
      post({ ...webhook, url: 'https://Hooks.Test/api/v1/nametag?token=abc' })
    );

    expect(response.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data.url).toBe(
      'https://hooks.test/api/v1/nametag?token=abc'
    );
  });

  it('rejects a webhook URL that carries a username or password, instead of silently dropping it', async () => {
    // normalizeWebhookUrl rebuilds the stored form from parsed.host, which
    // already discards userinfo. Storing the result without saying anything
    // would leave the endpoint 401ing on every delivery forever, with no
    // indication that the credentials the user put in the URL were ever
    // removed.
    const response = await POST(
      post({ ...webhook, url: 'https://user:pw@hooks.test/nametag' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    // A distinct code, not the generic 'invalid'. The client cannot render
    // the actionable "remove the credentials from the URL" message without
    // it, and that is the one rejection a user cannot diagnose by looking at
    // the URL themselves.
    expect(body.code).toBe('credentials_in_url');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects an ntfy URL that carries a username or password, the same as a webhook', async () => {
    // parseNtfyUrl builds its base from URL.origin, which silently discards
    // userinfo. Left unchecked, the destination is stored and shown back
    // without the credentials, then authenticates as nobody and fails every
    // delivery with nothing to say why. The webhook branch already refused
    // this; the ntfy branch did not.
    const response = await POST(
      post({ type: 'NTFY', label: 'Phone', url: 'https://user:pw@ntfy.test/my-topic' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('credentials_in_url');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects an ntfy URL where no ntfy server answers', async () => {
    // The #437 guard at save time. A host that merely parses like a topic
    // URL but is not ntfy would otherwise return 2xx for the publish POST,
    // count as delivered, and permanently stamp the reminder.
    mocks.probeNtfyHealth.mockResolvedValue('not_ntfy');

    const response = await POST(
      post({ type: 'NTFY', label: 'Phone', url: 'https://not-ntfy.test/my-topic' })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe('not_ntfy');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('still saves when the ntfy server could not be reached, since that proves nothing', async () => {
    // A timeout or a connection failure is not evidence the host is wrong.
    // Refusing on it would block any ntfy deployment whose /v1/health this
    // app cannot reach (behind Cloudflare Access, an auth proxy, or a WAF)
    // even though publishing to it works perfectly. The send-time guard still
    // covers the case where it really is not ntfy.
    mocks.probeNtfyHealth.mockResolvedValue('unreachable');

    const response = await POST(
      post({ type: 'NTFY', label: 'Phone', url: 'https://ntfy.internal/my-topic' })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalled();
  });

  it('does not health-probe a webhook URL, which has no such protocol to confirm', async () => {
    await POST(post(webhook));

    expect(mocks.probeNtfyHealth).not.toHaveBeenCalled();
  });

  it('enforces the per-user cap inside the transaction, not only in the pre-check', async () => {
    // The TOCTOU fix. The pre-check reads 0 (so the request proceeds), but the
    // authoritative count taken under the row lock sees the cap already met,
    // which is exactly the state two concurrent requests race into.
    let call = 0;
    prismaMock.notificationEndpoint.count.mockImplementation(() => {
      call += 1;
      return Promise.resolve(call === 1 ? 0 : 5);
    });

    const response = await POST(post(webhook));

    expect(response.status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects a URL whose normalised form exceeds the index byte limit', async () => {
    // 495 UTF-16 code units passes the schema's .max(500), but percent-encoding
    // during normalisation expands it past what a Postgres btree index entry
    // can hold, which would surface as a raw 500 instead of a clean 400.
    const longUrl = `https://hooks.test/${'é'.repeat(480)}`;

    const response = await POST(post({ ...webhook, url: longUrl }));

    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('endpoint item API', () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
  // The route reaches the delegates through the prisma mock; these aliases
  // are what the assertions below are written against, so keep them the
  // same function objects rather than two parallel sets of spies.
  mocks.count = prismaMock.notificationEndpoint.count;
  mocks.create = prismaMock.notificationEndpoint.create;
  mocks.findMany = prismaMock.notificationEndpoint.findMany;
  mocks.findFirst = prismaMock.notificationEndpoint.findFirst;
  mocks.updateMany = prismaMock.notificationEndpoint.updateMany;
  mocks.deleteMany = prismaMock.notificationEndpoint.deleteMany;
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

  it('replaces an ntfy access token in place', async () => {
    // Without this there is no way back from a NEXTAUTH_SECRET rotation:
    // every stored token becomes undecryptable, the destination fails
    // nightly, auto-disables, and re-enabling puts it straight back on the
    // same dead token.
    mocks.encryptSecret.mockReturnValue('encrypted-new-token');

    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { token: 'tk_new' }),
      ctx('ep-1')
    );

    expect(mocks.encryptSecret).toHaveBeenCalledWith('tk_new');
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ secret: 'encrypted-new-token' })
    );
  });

  it('clears an ntfy token when null is sent, distinct from omitting the field', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { token: null }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ secret: null })
    );
  });

  it('leaves the secret untouched when no token field is sent', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { label: 'New' }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty('secret');
  });

  it('resets the health counters when the credential changes', async () => {
    // A repaired destination should not stay tarred with the failure that
    // switched it off, or the user fixes the token and the row is still
    // disabled showing the old reason.
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { token: 'tk_new' }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        consecutiveFailures: 0,
        lastFailureCode: null,
        autoDisabledAt: null,
      })
    );
  });

  it('refuses a token on a webhook, which has no bearer credential', async () => {
    // sendNtfy puts the stored secret into an Authorization: Bearer header
    // while sendWebhook uses it as an HMAC key. Writing one where the other
    // is expected is a credential confusion, not a labelling mistake.
    mocks.findFirst.mockResolvedValue({ id: 'ep-1', type: 'WEBHOOK' });

    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { token: 'tk_new' }),
      ctx('ep-1')
    );

    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('rotates a webhook signing secret and returns it exactly once', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'ep-1', type: 'WEBHOOK' });
    mocks.encryptSecret.mockReturnValue('encrypted-rotated');

    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { rotateSecret: true }),
      ctx('ep-1')
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(typeof body.secret).toBe('string');
    expect(body.secret.length).toBeGreaterThan(0);
    // Generated server-side, never echoed from the request.
    expect(body.secret).not.toBe('encrypted-rotated');
    expect(mocks.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ secret: 'encrypted-rotated' })
    );
  });

  it('refuses to rotate a secret on an ntfy destination', async () => {
    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { rotateSecret: true }),
      ctx('ep-1')
    );

    expect(response.status).toBe(400);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('re-validates a replacement URL exactly as creation does', async () => {
    // An edit that skipped any check creation runs would be a way to reach a
    // state creation refuses to produce. The ntfy health probe is the one
    // most easily forgotten, so it is asserted specifically.
    mocks.probeNtfyHealth.mockResolvedValue('not_ntfy');

    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        url: 'https://not-ntfy.test/topic',
      }),
      ctx('ep-1')
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('not_ntfy');
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('stores the normalised form of a replacement URL', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        url: 'https://NTFY.sh/my-topic#frag',
      }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ url: 'https://ntfy.sh/my-topic' })
    );
  });

  it('rejects credentials in a replacement URL', async () => {
    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        url: 'https://user:pw@ntfy.test/my-topic',
      }),
      ctx('ep-1')
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('credentials_in_url');
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('reports a replacement URL that collides with another destination as a duplicate', async () => {
    mocks.updateMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const response = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        url: 'https://ntfy.sh/other-topic',
      }),
      ctx('ep-1')
    );

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('duplicate');
  });

  it('never takes the endpoint type from the request body', async () => {
    // Turning an ntfy destination into a webhook would reinterpret its stored
    // secret as a signing key rather than a bearer token.
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        label: 'New',
        type: 'WEBHOOK',
      }),
      ctx('ep-1')
    );

    expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty('type');
  });

  it('lets a lapsed subscriber switch a webhook OFF, and relabel it', async () => {
    // Turning a webhook off does not use the capability, so gating it on
    // entitlement left a user whose subscription had lapsed looking at a
    // banner saying the destination was no longer being delivered to, and
    // then getting a 403 when they tried to switch it off. Deleting it
    // outright was their only way out.
    mocks.findFirst.mockResolvedValue({ id: 'ep-1', type: 'WEBHOOK' });
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    const disabled = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { enabled: false }),
      ctx('ep-1')
    );
    expect(disabled.status).toBe(200);

    const relabelled = await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { label: 'Old receiver' }),
      ctx('ep-1')
    );
    expect(relabelled.status).toBe(200);
  });

  it('still refuses to let a lapsed subscriber put a webhook back into service', async () => {
    // The other half: re-enabling, re-pointing, or issuing a new signing
    // secret all USE the capability, so those stay gated. Catches widening
    // the exemption above into "webhooks are never entitlement-checked on
    // update", which would let a downgraded account resume delivery.
    mocks.findFirst.mockResolvedValue({ id: 'ep-1', type: 'WEBHOOK' });
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    for (const body of [
      { enabled: true },
      { url: 'https://hooks.example.com/new' },
      { rotateSecret: true },
    ]) {
      const response = await updateEndpoint(
        jsonRequest('http://localhost/api/notifications/endpoints/ep-1', body),
        ctx('ep-1')
      );
      expect(response.status).toBe(403);
    }

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('meters a URL change against the same per-user outbound ceiling a test send uses', async () => {
    // A URL change triggers DNS and, for ntfy, a health probe. Both it and a
    // test send are user-triggered outbound requests, so it is the total that
    // needs bounding, not each in its own private allowance.
    const types: string[] = [];
    mocks.checkRateLimit.mockImplementation((_request: unknown, type: string) => {
      types.push(type);
      return null;
    });

    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', {
        url: 'https://ntfy.sh/other-topic',
      }),
      ctx('ep-1')
    );

    expect(types).toContain('notificationEndpointTestPerUser');
  });

  it('does not spend outbound budget on an edit that changes no URL', async () => {
    await updateEndpoint(
      jsonRequest('http://localhost/api/notifications/endpoints/ep-1', { label: 'New' }),
      ctx('ep-1')
    );

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
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
  // The route reaches the delegates through the prisma mock; these aliases
  // are what the assertions below are written against, so keep them the
  // same function objects rather than two parallel sets of spies.
  mocks.count = prismaMock.notificationEndpoint.count;
  mocks.create = prismaMock.notificationEndpoint.create;
  mocks.findMany = prismaMock.notificationEndpoint.findMany;
  mocks.findFirst = prismaMock.notificationEndpoint.findFirst;
  mocks.updateMany = prismaMock.notificationEndpoint.updateMany;
  mocks.deleteMany = prismaMock.notificationEndpoint.deleteMany;
    webhookMocks.canUseWebhooks.mockReset();
    webhookMocks.sendWebhook.mockReset();
    webhookMocks.canUseWebhooks.mockResolvedValue(true);
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
    // The per-user ceiling is checked before the endpoint is looked up, so
    // the query that validates the id is itself metered. Without this
    // assertion, moving every limit below the findFirst lookup would still
    // leave sendNtfy uncalled and pass, even though the lookup had run
    // unmetered.
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('applies the per-user ceiling first and the per-destination limit second', async () => {
    // Two limits with different keys, in a specific order. The per-user one
    // has to come first because the per-destination key is built from a
    // validated endpoint id, and validating one costs the query the per-user
    // limit exists to meter. Keying the per-destination limit on the raw path
    // parameter instead would let a caller mint unbounded buckets by
    // inventing ids.
    const calls: Array<{ type: string; identifier: string | undefined; afterLookup: boolean }> = [];
    let lookedUp = false;

    mocks.findFirst.mockImplementation(() => {
      lookedUp = true;
      return Promise.resolve({
        id: 'ep-1',
        type: 'NTFY',
        url: 'https://ntfy.sh/my-topic',
        secret: null,
        enabled: true,
      });
    });
    mocks.checkRateLimit.mockImplementation(
      (_request: unknown, type: string, identifier?: string) => {
        calls.push({ type, identifier, afterLookup: lookedUp });
        return null;
      }
    );

    await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(calls).toEqual([
      { type: 'notificationEndpointTestPerUser', identifier: 'user-1', afterLookup: false },
      { type: 'notificationEndpointTest', identifier: 'endpoint:ep-1', afterLookup: true },
    ]);
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

  it('does not erase why a disabled endpoint was switched off when a test succeeds', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'ep-1',
      type: 'NTFY',
      url: 'https://ntfy.sh/my-topic',
      secret: null,
      enabled: false,
      autoDisabledAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    // recordEndpointResult's success branch clears consecutiveFailures,
    // lastFailureCode and autoDisabledAt, but never sets enabled back to
    // true. Calling it here would leave the row enabled: false with the
    // reason it was disabled erased. Re-enabling is the user's deliberate
    // act, via PUT, not a side effect of testing.
    expect(mocks.recordEndpointResult).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: true });
  });

  it('routes a WEBHOOK test-send to sendWebhook, never to sendNtfy, so its signing secret is never sent as a bearer token', async () => {
    // sendNtfy decrypts endpoint.secret and sends it as an Authorization
    // header to endpoint.url. A webhook's secret is an HMAC signing key, not
    // a bearer token: handing this endpoint to sendNtfy would leak that
    // signing key to the webhook's own URL. This is the successor to a test
    // that used to pin a 400 rejection for any non-NTFY type; now that
    // webhooks are a real, creatable endpoint type, the protection is that
    // this routes to the webhook driver, not that it is refused outright.
    mocks.findFirst.mockResolvedValue({
      id: 'ep-1',
      type: 'WEBHOOK',
      url: 'https://example.test/hook',
      secret: 'encrypted-signing-key',
      enabled: true,
    });
    webhookMocks.sendWebhook.mockResolvedValue({ ok: true });

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(webhookMocks.sendWebhook).toHaveBeenCalled();
    expect(mocks.sendNtfy).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('refuses a WEBHOOK test-send when the user is not entitled', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'ep-1',
      type: 'WEBHOOK',
      url: 'https://example.test/hook',
      secret: 'encrypted-signing-key',
      enabled: true,
    });
    webhookMocks.canUseWebhooks.mockResolvedValue(false);

    const response = await testEndpoint(jsonRequest('http://localhost/x'), ctx('ep-1'));

    expect(response.status).toBe(403);
    expect(webhookMocks.sendWebhook).not.toHaveBeenCalled();
    expect(mocks.sendNtfy).not.toHaveBeenCalled();
  });
});
