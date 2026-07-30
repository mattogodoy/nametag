import { describe, it, expect, vi } from 'vitest';
import { requireTrashedRecord } from '@/lib/api/trash-guards';

const messages = {
  notFound: 'Person not found',
  notDeleted: 'Person is not deleted',
};

describe('requireTrashedRecord', () => {
  it('passes the record through when it is trashed', async () => {
    const record = { id: 'p1', deletedAt: new Date('2024-01-01') };

    const result = await requireTrashedRecord(async () => record, messages);

    expect(result.ok).toBe(true);
    expect(result.ok && result.record).toBe(record);
  });

  it('answers 404 when the record does not exist', async () => {
    const result = await requireTrashedRecord(async () => null, messages);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(404);
    expect(await result.response.json()).toEqual({ error: 'Person not found' });
  });

  it('answers 400 when the record exists but is not trashed', async () => {
    const result = await requireTrashedRecord(
      async () => ({ id: 'p1', deletedAt: null }),
      messages
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.response.status).toBe(400);
    expect(await result.response.json()).toEqual({
      error: 'Person is not deleted',
    });
  });

  it('does not run the lookup more than once', async () => {
    const find = vi.fn(async () => ({ id: 'p1', deletedAt: new Date() }));

    await requireTrashedRecord(find, messages);

    expect(find).toHaveBeenCalledTimes(1);
  });

  it('lets a lookup failure propagate to the route error handler', async () => {
    await expect(
      requireTrashedRecord(async () => {
        throw new Error('db down');
      }, messages)
    ).rejects.toThrow('db down');
  });
});
