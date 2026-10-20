import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  canCreateResource: vi.fn(),
  getUserUsage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { findFirst: vi.fn(async () => null) },
    group: { findFirst: vi.fn(async () => null) },
    customFieldTemplate: { findMany: vi.fn(async () => []) },
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

import { POST } from '@/app/api/user/import/route';

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
  new Request('http://localhost/api/user/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/user/import plan limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserUsage.mockResolvedValue({ people: 50, groups: 0 });
  });

  it('refuses an import over the people limit with plan_limit_reached', async () => {
    mocks.canCreateResource.mockResolvedValue({ isUnlimited: false, limit: 50, current: 50 });
    const res = await POST(req(payload()));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'people', limit: 50 });
    expect(body.error).toMatch(/^Import would exceed your plan limit/);
  });

  it('refuses an import over the groups limit with plan_limit_reached', async () => {
    mocks.getUserUsage.mockResolvedValue({ people: 0, groups: 10 });
    mocks.canCreateResource.mockImplementation(async (_id: string, resource: string) =>
      resource === 'groups'
        ? { isUnlimited: false, limit: 10, current: 10 }
        : { isUnlimited: true, limit: 0, current: 0 }
    );
    const res = await POST(req(payload({ groups: [{ id: 'g1', name: 'G' }] })));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'groups', limit: 10 });
  });

  it('refuses an import over the custom field limit with plan_limit_reached', async () => {
    mocks.getUserUsage.mockResolvedValue({ people: 0, groups: 0 });
    mocks.canCreateResource.mockImplementation(async (_id: string, resource: string) =>
      resource === 'customFieldTemplates'
        ? { isUnlimited: false, limit: 3, current: 3 }
        : { isUnlimited: true, limit: 0, current: 0 }
    );
    const res = await POST(
      req(payload({ customFieldTemplates: [{ name: 'Diet', slug: 'diet', type: 'TEXT', options: [], order: 0 }] }))
    );
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.code).toBe('plan_limit_reached');
    expect(body.params).toEqual({ resource: 'customFieldTemplates', limit: 3 });
  });
});
