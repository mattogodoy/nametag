import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';

const mocks = vi.hoisted(() => ({
  connectionFindUnique: vi.fn(),
  conflictFindUnique: vi.fn(),
  validateServerUrl: vi.fn(),
  createDAVClient: vi.fn(),
}));

vi.mock('@/lib/auth');

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: { findUnique: mocks.connectionFindUnique },
    cardDavConflict: { findUnique: mocks.conflictFindUnique },
  },
}));

vi.mock('@/lib/carddav/url-validation', () => ({
  validateServerUrl: mocks.validateServerUrl,
}));

vi.mock('@/lib/carddav/encryption', () => ({
  encryptPassword: vi.fn(() => 'enc'),
  decryptPassword: vi.fn(() => 'pw'),
}));

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null }));

vi.mock('tsdav', () => ({ createDAVClient: mocks.createDAVClient }));

vi.mock('@/lib/carddav/client', () => ({ createCardDavClient: vi.fn() }));

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

import { POST as createConnection } from '@/app/api/carddav/connection/route';
import { POST as testConnection } from '@/app/api/carddav/connection/test/route';
import { POST as exportBulk } from '@/app/api/carddav/export-bulk/route';
import { POST as resolveConflict } from '@/app/api/carddav/conflicts/[id]/resolve/route';

function post(url: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validConnection = { serverUrl: 'https://dav.example.com', username: 'u', password: 'p' };

describe('CardDAV route error codes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com' } });
    mocks.validateServerUrl.mockResolvedValue(undefined);
  });

  it('create connection without a password returns password_required', async () => {
    const res = await createConnection(
      post('/api/carddav/connection', { serverUrl: validConnection.serverUrl, username: 'u' })
    );
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('password_required');
    expect(data.error).toBe('Password is required when creating a new connection');
  });

  it('create connection when one exists returns conflict', async () => {
    mocks.connectionFindUnique.mockResolvedValue({ id: 'conn-1' });
    const res = await createConnection(post('/api/carddav/connection', validConnection));
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.code).toBe('conflict');
    expect(data.error).toBe('Connection already exists. Use PUT to update.');
  });

  it('connection test auth failure returns 400 carddav_auth_failed', async () => {
    mocks.createDAVClient.mockRejectedValue(new Error('Invalid credentials, response 401'));
    const res = await testConnection(post('/api/carddav/connection/test', validConnection));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('carddav_auth_failed');
    expect(data.error).toBe('Authentication failed. Please check your username and password.');
  });

  it('connection test timeout returns 502 carddav_unreachable', async () => {
    mocks.createDAVClient.mockRejectedValue(new Error('connect ETIMEDOUT'));
    const res = await testConnection(post('/api/carddav/connection/test', validConnection));
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.code).toBe('carddav_unreachable');
    expect(data.error).toBe('Connection timeout. Please check the server URL and your network.');
  });

  it('connection test generic failure returns 502 carddav_unreachable', async () => {
    mocks.createDAVClient.mockRejectedValue(new Error('boom'));
    const res = await testConnection(post('/api/carddav/connection/test', validConnection));
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.code).toBe('carddav_unreachable');
  });

  it('bulk export with sync disabled returns feature_disabled', async () => {
    mocks.connectionFindUnique.mockResolvedValue({ id: 'conn-1', syncEnabled: false });
    const res = await exportBulk(post('/api/carddav/export-bulk', { personIds: ['p1'] }));
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.code).toBe('feature_disabled');
    expect(data.params).toEqual({ feature: 'carddav_sync', scope: 'user' });
    expect(data.error).toBe('Sync is disabled for this connection');
  });

  it('resolving an already resolved conflict returns conflict_already_resolved', async () => {
    mocks.conflictFindUnique.mockResolvedValue({
      id: 'c1',
      resolvedAt: new Date(),
      mapping: { connection: { userId: 'user-1' } },
    });
    const res = await resolveConflict(
      post('/api/carddav/conflicts/c1/resolve', { resolution: 'keep_local' }),
      { params: Promise.resolve({ id: 'c1' }) }
    );
    const data = await res.json();
    expect(res.status).toBe(409);
    expect(data.code).toBe('conflict_already_resolved');
    expect(data.error).toBe('Conflict already resolved');
  });

  it('connection test 404 returns 502 carddav_unreachable', async () => {
    mocks.createDAVClient.mockRejectedValue(new Error('404 not found'));
    const res = await testConnection(post('/api/carddav/connection/test', validConnection));
    const data = await res.json();
    expect(res.status).toBe(502);
    expect(data.code).toBe('carddav_unreachable');
    expect(data.error).toBe('Server not found. Please check the server URL.');
  });

  it('invalid input returns validation_failed with legacy details and fields', async () => {
    const res = await exportBulk(post('/api/carddav/export-bulk', { personIds: 'nope' }));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.code).toBe('validation_failed');
    expect(data.error).toBe('Invalid input');
    expect(data.details[0]).toEqual(expect.objectContaining({ path: ['personIds'], code: 'invalid_type' }));
    expect(data.fields).toContainEqual(expect.objectContaining({ path: 'personIds' }));
  });
});
