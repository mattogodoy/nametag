import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  typeFindFirst: vi.fn(),
  typeUpdate: vi.fn(),
  variantDeleteMany: vi.fn(),
  variantCreate: vi.fn(),
  groupFindMany: vi.fn(),
  templateFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    relationshipType: { findFirst: mocks.typeFindFirst, update: mocks.typeUpdate },
    relationshipLabelVariant: {
      deleteMany: mocks.variantDeleteMany,
      create: mocks.variantCreate,
    },
    group: { findMany: mocks.groupFindMany },
    customFieldTemplate: { findMany: mocks.templateFindMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'a@b.c', name: 'Test' } })
  ),
}));

import { PUT } from '@/app/api/relationship-types/[id]/route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/relationship-types/type-1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  name: 'FRATRIE',
  label: 'Frere/Soeur',
  color: '#8B5CF6',
};

const genderCondition = {
  subject: 'DESCRIBED',
  source: 'PERSON_FIELD',
  subjectRef: 'gender',
  operator: 'IS',
  operand: 'lit:Homme',
};

describe('PUT /api/relationship-types/[id] with variants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The PUT handler calls findFirst twice: once for ownership, once to check
    // for a duplicate name. A single mockResolvedValue would answer both and
    // make every request fail as a name collision.
    mocks.typeFindFirst.mockReset();
    mocks.typeFindFirst
      .mockResolvedValueOnce({ id: 'type-1', userId: 'user-123', name: 'FRATRIE' })
      .mockResolvedValue(null);
    mocks.typeUpdate.mockResolvedValue({ id: 'type-1', label: 'Frere/Soeur' });
    mocks.variantDeleteMany.mockResolvedValue({ count: 0 });
    mocks.variantCreate.mockResolvedValue({ id: 'v1' });
    mocks.groupFindMany.mockResolvedValue([]);
    mocks.templateFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        relationshipType: { update: mocks.typeUpdate },
        relationshipLabelVariant: {
          deleteMany: mocks.variantDeleteMany,
          create: mocks.variantCreate,
        },
      })
    );
  });

  it('replaces variants wholesale, in array order', async () => {
    const response = await PUT(
      request({
        ...baseBody,
        variants: [
          { label: 'frere', conditions: [genderCondition] },
          { label: 'fratrie', conditions: [] },
        ],
      }),
      { params: Promise.resolve({ id: 'type-1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.variantDeleteMany).toHaveBeenCalledWith({
      where: { relationshipTypeId: 'type-1' },
    });
    expect(mocks.variantCreate).toHaveBeenCalledTimes(2);
    expect(mocks.variantCreate.mock.calls[0][0].data.order).toBe(0);
    expect(mocks.variantCreate.mock.calls[1][0].data.order).toBe(1);
  });

  it('leaves the configuration untouched when variants is omitted', async () => {
    const response = await PUT(request(baseBody), { params: Promise.resolve({ id: 'type-1' }) });
    expect(response.status).toBe(200);
    expect(mocks.variantDeleteMany).not.toHaveBeenCalled();
  });

  it('clears the configuration on an empty array', async () => {
    const response = await PUT(request({ ...baseBody, variants: [] }), {
      params: Promise.resolve({ id: 'type-1' }),
    });
    expect(response.status).toBe(200);
    expect(mocks.variantDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.variantCreate).not.toHaveBeenCalled();
  });

  it('rejects a condition pointing at a group the user does not own', async () => {
    mocks.groupFindMany.mockResolvedValue([]);
    const response = await PUT(
      request({
        ...baseBody,
        variants: [
          {
            label: 'x',
            conditions: [
              { subject: 'DESCRIBED', source: 'GROUP', subjectRef: 'other-user-group', operator: 'IN_GROUP', operand: null },
            ],
          },
        ],
      }),
      { params: Promise.resolve({ id: 'type-1' }) }
    );
    expect(response.status).toBe(400);
    expect(mocks.variantDeleteMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid variant list before touching the database', async () => {
    const response = await PUT(
      request({
        ...baseBody,
        variants: [
          { label: 'a', conditions: [] },
          { label: 'b', conditions: [genderCondition] },
        ],
      }),
      { params: Promise.resolve({ id: 'type-1' }) }
    );
    expect(response.status).toBe(400);
    expect(mocks.variantDeleteMany).not.toHaveBeenCalled();
  });
});
