import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: { user: { update: mocks.userUpdate } },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 't@example.com', name: 'T' } }),
  ),
}));

import { PUT } from '../../app/api/user/graph-display/route';

describe('PUT /api/user/graph-display', () => {
  beforeEach(() => vi.clearAllMocks());

  const make = (body: unknown) =>
    new Request('http://localhost/api/user/graph-display', {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });

  it('persists graphMode=individuals', async () => {
    mocks.userUpdate.mockResolvedValue({ id: 'user-123', graphMode: 'individuals' });
    const res = await PUT(make({ graphMode: 'individuals' }));
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-123' },
      data: { graphMode: 'individuals' },
    }));
  });

  it('persists graphMode=bubbles', async () => {
    mocks.userUpdate.mockResolvedValue({ id: 'user-123', graphMode: 'bubbles' });
    const res = await PUT(make({ graphMode: 'bubbles' }));
    expect(res.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { graphMode: 'bubbles' },
    }));
  });

  it('rejects an invalid graphMode value', async () => {
    const res = await PUT(make({ graphMode: 'foo' }));
    expect(res.status).toBe(400);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it('rejects null graphMode (no longer supported)', async () => {
    const res = await PUT(make({ graphMode: null }));
    expect(res.status).toBe(400);
  });

  it('rejects an empty body', async () => {
    const res = await PUT(make({}));
    expect(res.status).toBe(400);
  });
});
