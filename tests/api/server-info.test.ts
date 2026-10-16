import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getServerInfo: vi.fn() }));

vi.mock('@/lib/server-info', () => ({ getServerInfo: mocks.getServerInfo }));
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { GET } from '@/app/api/server-info/route';

const INFO = {
  name: 'Nametag',
  version: '0.64.0',
  apiVersion: 1,
  mode: 'selfhosted',
  auth: {
    password: true,
    google: false,
    oidc: { enabled: false, name: 'SSO' },
    emailVerificationRequired: false,
    registration: { enabled: true },
  },
  features: { billing: false, cardDav: true, webPush: false },
};

describe('GET /api/server-info', () => {
  beforeEach(() => {
    mocks.getServerInfo.mockReset();
  });

  it('returns the server description without authentication', async () => {
    mocks.getServerInfo.mockResolvedValue(INFO);
    const res = await GET(new Request('http://localhost/api/server-info'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(INFO);
  });

  it('allows short private caching only', async () => {
    mocks.getServerInfo.mockResolvedValue(INFO);
    const res = await GET(new Request('http://localhost/api/server-info'));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  it('returns 503 without internals when the database is unreachable', async () => {
    mocks.getServerInfo.mockRejectedValue(
      new Error("Can't reach database server at `db.internal.example:5432`")
    );
    const res = await GET(new Request('http://localhost/api/server-info'));
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain('db.internal.example');
  });
});
