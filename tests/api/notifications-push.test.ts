import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  userUpdate: vi.fn(),
  getVapidDetails: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({ auth: mocks.auth }));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
      findUnique: mocks.findUnique,
      count: mocks.count,
    },
    user: { update: mocks.userUpdate },
  },
}));

vi.mock('../../lib/notifications/vapid', () => ({
  getVapidDetails: mocks.getVapidDetails,
  isPushConfigured: () => mocks.getVapidDetails() !== null,
}));

vi.mock('../../lib/rate-limit', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/rate-limit')>('../../lib/rate-limit');
  return {
    ...actual,
    checkRateLimit: mocks.checkRateLimit,
  };
});

import { GET as getPublicKey } from '../../app/api/notifications/push/public-key/route';
import { POST as subscribe } from '../../app/api/notifications/push/subscribe/route';
import { DELETE as revoke } from '../../app/api/notifications/push/subscriptions/[id]/route';
import { PUT as toggleEmailReminders } from '../../app/api/notifications/email/route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TestBrowser/1.0' },
    body: JSON.stringify(body),
  });
}

/** Sends a body that is not valid JSON at all, to exercise the parse-failure path. */
function rawRequest(url: string, method: string, rawBody: string): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
}

function emailToggleRequest(body: unknown): Request {
  return new Request('http://localhost/api/notifications/email', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

const validBody = {
  endpoint: 'https://push.test/abc',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

describe('push API', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.getVapidDetails.mockReturnValue({
      publicKey: 'pub-key',
      privateKey: 'priv',
      subject: 'mailto:a@b.test',
    });
    mocks.upsert.mockResolvedValue({ id: 'sub-1' });
    mocks.checkRateLimit.mockReturnValue(null);
    // No existing row and comfortably under the cap unless a test says otherwise.
    mocks.findUnique.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
  });

  it('serves the public key but never the private key', async () => {
    const response = await getPublicKey();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ publicKey: 'pub-key' });
    expect(JSON.stringify(json)).not.toContain('priv');
  });

  it('returns 404 for the public key when push is not configured', async () => {
    mocks.getVapidDetails.mockReturnValue(null);

    expect((await getPublicKey()).status).toBe(404);
  });

  it('rejects an unauthenticated subscribe', async () => {
    mocks.auth.mockResolvedValue(null);

    expect((await subscribe(request(validBody))).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('upserts by endpoint so re-subscribing does not duplicate rows', async () => {
    const response = await subscribe(request(validBody));

    expect(response.status).toBe(201);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { endpoint: 'https://push.test/abc' } })
    );
  });

  it('records the user agent for device labelling', async () => {
    await subscribe(request(validBody));

    expect(mocks.upsert.mock.calls[0][0].create.userAgent).toBe('TestBrowser/1.0');
  });

  it('re-subscribing clears any auto-disable, since it proves the device is reachable again', async () => {
    // A browser re-subscribing normally reuses the same endpoint, so this is
    // the update branch, not the create branch. Without resetting these
    // fields here, a device that auto-disabled after repeated failures would
    // stay excluded by the autoDisabledAt filter forever, even after the
    // user does the obvious thing to fix it.
    mocks.findUnique.mockResolvedValue({ id: 'sub-1' });

    await subscribe(request(validBody));

    expect(mocks.upsert.mock.calls[0][0].update).toEqual(
      expect.objectContaining({
        consecutiveFailures: 0,
        lastFailureCode: null,
        autoDisabledAt: null,
      })
    );
  });

  it('rejects a malformed subscription body', async () => {
    const response = await subscribe(request({ endpoint: 'not-a-url', keys: {} }));

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects an over-long endpoint rather than storing it', async () => {
    const response = await subscribe(
      request({ endpoint: `https://push.test/${'a'.repeat(2100)}`, keys: validBody.keys })
    );

    expect(response.status).toBe(400);
  });

  it('rejects an endpoint that is short in characters but over the byte ceiling', async () => {
    // 1500 three-byte characters is 4500 UTF-8 bytes, which passes a naive
    // .max(2000) on string length but would blow the unique btree index.
    const response = await subscribe(
      request({ endpoint: `https://push.test/${'中'.repeat(1500)}`, keys: validBody.keys })
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a non-https endpoint', async () => {
    const response = await subscribe(
      request({ endpoint: 'http://push.test/abc', keys: validBody.keys })
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a subscribe body that is not JSON at all, rather than 500ing', async () => {
    const response = await subscribe(
      rawRequest('http://localhost/api/notifications/push/subscribe', 'POST', 'not json at all')
    );

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a new subscription once the caller already holds 20 devices', async () => {
    mocks.count.mockResolvedValue(20);

    const response = await subscribe(request(validBody));

    expect(response.status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('allows re-subscribing an existing endpoint even at the cap', async () => {
    // The endpoint already has a row, so this call updates it rather than
    // creating a new one, and must not be blocked by the per-user cap.
    mocks.findUnique.mockResolvedValue({ id: 'sub-1' });
    mocks.count.mockResolvedValue(20);

    const response = await subscribe(request(validBody));

    expect(response.status).toBe(201);
    expect(mocks.upsert).toHaveBeenCalled();
  });

  it('is rate limited', async () => {
    mocks.checkRateLimit.mockReturnValue(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    );

    const response = await subscribe(request(validBody));

    expect(response.status).toBe(429);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  describe('DELETE /api/notifications/push/subscriptions/[id]', () => {
    it('rejects an unauthenticated revoke', async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await revoke(
        new Request('http://localhost/api/notifications/push/subscriptions/sub-1', {
          method: 'DELETE',
        }),
        deleteContext('sub-1')
      );

      expect(response.status).toBe(401);
      expect(mocks.deleteMany).not.toHaveBeenCalled();
    });

    it('revokes an owned subscription, scoped by userId', async () => {
      mocks.deleteMany.mockResolvedValue({ count: 1 });

      const response = await revoke(
        new Request('http://localhost/api/notifications/push/subscriptions/sub-1', {
          method: 'DELETE',
        }),
        deleteContext('sub-1')
      );

      // The userId filter is the whole point: without it, any signed-in user
      // could revoke another account's device by guessing an id. Asserted
      // before the status so a regression here fails loudly on the call
      // itself, not just on a downstream status code.
      expect(mocks.deleteMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', userId: 'user-1' },
      });
      expect(response.status).toBe(200);
    });

    it("returns 404 when the subscription is not the caller's or does not exist", async () => {
      mocks.deleteMany.mockResolvedValue({ count: 0 });

      const response = await revoke(
        new Request('http://localhost/api/notifications/push/subscriptions/sub-1', {
          method: 'DELETE',
        }),
        deleteContext('sub-1')
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/notifications/email', () => {
    it('rejects an unauthenticated toggle', async () => {
      mocks.auth.mockResolvedValue(null);

      const response = await toggleEmailReminders(emailToggleRequest({ enabled: false }));

      expect(response.status).toBe(401);
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean enabled value', async () => {
      const response = await toggleEmailReminders(emailToggleRequest({ enabled: 'yes' }));

      expect(response.status).toBe(400);
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it('rejects a toggle body that is not JSON at all, rather than 500ing', async () => {
      const response = await toggleEmailReminders(
        rawRequest('http://localhost/api/notifications/email', 'PUT', 'not json at all')
      );

      expect(response.status).toBe(400);
      expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it("updates the caller's own row", async () => {
      const response = await toggleEmailReminders(emailToggleRequest({ enabled: false }));

      expect(response.status).toBe(200);
      expect(mocks.userUpdate).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailRemindersEnabled: false },
      });
    });
  });
});
