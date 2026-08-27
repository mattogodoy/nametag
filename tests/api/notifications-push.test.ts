import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
  userUpdate: vi.fn(),
  getVapidDetails: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({ auth: mocks.auth }));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    pushSubscription: { upsert: mocks.upsert, deleteMany: mocks.deleteMany },
    user: { update: mocks.userUpdate },
  },
}));

vi.mock('../../lib/notifications/vapid', () => ({
  getVapidDetails: mocks.getVapidDetails,
  isPushConfigured: () => mocks.getVapidDetails() !== null,
}));

import { GET as getPublicKey } from '../../app/api/notifications/push/public-key/route';
import { POST as subscribe } from '../../app/api/notifications/push/subscribe/route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/notifications/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TestBrowser/1.0' },
    body: JSON.stringify(body),
  });
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
});
