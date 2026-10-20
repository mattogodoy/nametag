import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canCreateResource: vi.fn(),
  getUserUsage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { findFirst: vi.fn(async () => null) },
    group: { findFirst: vi.fn(async () => null) },
  },
}));
vi.mock('@/lib/billing', () => ({
  canCreateResource: mocks.canCreateResource,
  getUserUsage: mocks.getUserUsage,
}));
vi.mock('@/lib/features', () => ({ isFeatureEnabled: () => true, isSaasMode: () => true }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) =>
        handler(req, { user: { id: 'u1' }, authMethod: 'session' }, { params: Promise.resolve({}) }),
  };
});
vi.mock('@/lib/logger', () => {
  const log = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: log, createModuleLogger: vi.fn(() => log) };
});

import { POST } from '@/app/api/user/import/validate/route';

const payload = (extra: Record<string, unknown> = {}) => ({
  version: '1.1',
  exportDate: '2026-01-01T00:00:00.000Z',
  groups: [],
  people: [{ id: 'p1', name: 'Ada', groups: [], relationships: [] }],
  relationships: [],
  relationshipTypes: [],
  journalEntries: [],
  ...extra,
});

const req = (body: unknown) =>
  new Request('http://localhost/api/user/import/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/user/import/validate plan limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the 200 body and adds plan_limit_reached for people', async () => {
    mocks.getUserUsage.mockResolvedValue({ people: 50, groups: 0 });
    mocks.canCreateResource.mockResolvedValue({ isUnlimited: false, limit: 50, current: 50 });
    const res = await POST(req(payload()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      valid: false,
      error: 'people',
      current: 50,
      newCount: 1,
      limit: 50,
      totalAfterImport: 51,
      code: 'plan_limit_reached',
      params: { resource: 'people', limit: 50 },
    });
    expect(body.message).toMatch(/^Import would exceed your plan limit/);
  });

  it('keeps the 200 body and adds plan_limit_reached for groups', async () => {
    mocks.getUserUsage.mockResolvedValue({ people: 0, groups: 10 });
    mocks.canCreateResource.mockImplementation(async (_id: string, resource: string) =>
      resource === 'groups'
        ? { isUnlimited: false, limit: 10, current: 10 }
        : { isUnlimited: true, limit: 0, current: 0 }
    );
    const res = await POST(req(payload({ groups: [{ id: 'g1', name: 'G' }] })));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      valid: false,
      error: 'groups',
      limit: 10,
      code: 'plan_limit_reached',
      params: { resource: 'groups', limit: 10 },
    });
  });
});
