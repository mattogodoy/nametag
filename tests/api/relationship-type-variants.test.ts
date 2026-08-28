import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  typeFindFirst: vi.fn(),
  typeUpdate: vi.fn(),
  typeCreate: vi.fn(),
  variantDeleteMany: vi.fn(),
  variantCreate: vi.fn(),
  groupFindMany: vi.fn(),
  templateFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    relationshipType: {
      findFirst: mocks.typeFindFirst,
      update: mocks.typeUpdate,
      create: mocks.typeCreate,
    },
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
import { POST } from '@/app/api/relationship-types/route';

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

const nicknameCondition = {
  subject: 'DESCRIBED',
  source: 'PERSON_FIELD',
  subjectRef: 'nickname',
  operator: 'IS',
  operand: 'lit:Coco',
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
          { label: 'frere', conditions: [nicknameCondition] },
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
          { label: 'b', conditions: [nicknameCondition] },
        ],
      }),
      { params: Promise.resolve({ id: 'type-1' }) }
    );
    expect(response.status).toBe(400);
    expect(mocks.variantDeleteMany).not.toHaveBeenCalled();
  });
});

describe('PUT /api/relationship-types/[id] with a symmetric type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Same two-call findFirst shape as the asymmetric PUT tests: ownership
    // check first, then the duplicate-name check.
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
        symmetric: true,
        variants: [
          { label: 'frere', conditions: [nicknameCondition] },
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

  it('clears the configuration on an empty array', async () => {
    const response = await PUT(request({ ...baseBody, symmetric: true, variants: [] }), {
      params: Promise.resolve({ id: 'type-1' }),
    });
    expect(response.status).toBe(200);
    expect(mocks.variantDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.variantCreate).not.toHaveBeenCalled();
  });

  it('leaves the configuration untouched when variants is omitted', async () => {
    const response = await PUT(request({ ...baseBody, symmetric: true }), {
      params: Promise.resolve({ id: 'type-1' }),
    });
    expect(response.status).toBe(200);
    expect(mocks.variantDeleteMany).not.toHaveBeenCalled();
    expect(mocks.variantCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/relationship-types with variants', () => {
  function postRequest(body: unknown): Request {
    return new Request('http://localhost/api/relationship-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // POST has no ownership lookup (there is nothing to own yet). Its only
    // findFirst calls are duplicate-name checks (main type, and the inverse
    // type when inverseLabel is sent), which should all find nothing.
    mocks.typeFindFirst.mockReset();
    mocks.typeFindFirst.mockResolvedValue(null);
    mocks.typeCreate.mockReset();
    mocks.typeUpdate.mockReset();
    mocks.variantDeleteMany.mockResolvedValue({ count: 0 });
    mocks.variantCreate.mockResolvedValue({ id: 'v1' });
    mocks.groupFindMany.mockResolvedValue([]);
    mocks.templateFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        relationshipType: { update: mocks.typeUpdate, create: mocks.typeCreate },
        relationshipLabelVariant: {
          deleteMany: mocks.variantDeleteMany,
          create: mocks.variantCreate,
        },
      })
    );
  });

  it('writes variants for a symmetric type created with them', async () => {
    // The symmetric branch creates the type, then updates it to point at
    // itself as its own inverse. Only the create happens outside the
    // transaction; the self-referencing update is what carries the variants.
    mocks.typeCreate.mockResolvedValueOnce({ id: 'sym-type-1' });
    mocks.typeUpdate.mockResolvedValueOnce({ id: 'sym-type-1', inverseId: 'sym-type-1' });

    const response = await POST(
      postRequest({
        name: 'AMI',
        label: 'Ami',
        color: '#8B5CF6',
        symmetric: true,
        variants: [
          { label: 'ami', conditions: [nicknameCondition] },
          { label: 'amie', conditions: [] },
        ],
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.variantDeleteMany).toHaveBeenCalledWith({
      where: { relationshipTypeId: 'sym-type-1' },
    });
    expect(mocks.variantCreate).toHaveBeenCalledTimes(2);
    expect(mocks.variantCreate.mock.calls[0][0].data.order).toBe(0);
    expect(mocks.variantCreate.mock.calls[1][0].data.order).toBe(1);
  });

  it('does not give an auto-created inverse type any variants', async () => {
    // inverseLabel makes the route create the inverse type first (no
    // variants), then create the main type inside the transaction that
    // carries the variants.
    mocks.typeCreate
      .mockResolvedValueOnce({ id: 'inverse-type-1' })
      .mockResolvedValueOnce({ id: 'main-type-1' });
    mocks.typeUpdate.mockResolvedValueOnce({ id: 'inverse-type-1', inverseId: 'main-type-1' });

    const response = await POST(
      postRequest({
        name: 'PARENT',
        label: 'Parent',
        color: '#8B5CF6',
        inverseLabel: 'Child',
        variants: [{ label: 'papa', conditions: [nicknameCondition] }],
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.variantDeleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.variantDeleteMany).toHaveBeenCalledWith({
      where: { relationshipTypeId: 'main-type-1' },
    });
    expect(mocks.variantDeleteMany).not.toHaveBeenCalledWith({
      where: { relationshipTypeId: 'inverse-type-1' },
    });
    expect(mocks.variantCreate).toHaveBeenCalledTimes(1);
    expect(mocks.variantCreate.mock.calls[0][0].data.relationshipTypeId).toBe('main-type-1');
  });
});
