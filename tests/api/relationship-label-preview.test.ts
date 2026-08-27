import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  customValueFindMany: vi.fn(),
  importantDateFindMany: vi.fn(),
  personCount: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: { findMany: mocks.personFindMany, count: mocks.personCount },
    personGroup: { findMany: mocks.personGroupFindMany },
    personCustomFieldValue: { findMany: mocks.customValueFindMany },
    importantDate: { findMany: mocks.importantDateFindMany },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'a@b.c', name: 'Test' } })
  ),
}));

import { POST } from '@/app/api/relationship-types/preview-label/route';

function request(body: unknown): Request {
  return new Request('http://localhost/api/relationship-types/preview-label', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const variants = [
  {
    label: 'frere',
    conditions: [
      { subject: 'DESCRIBED', source: 'PERSON_FIELD', subjectRef: 'gender', operator: 'IS', operand: 'lit:Homme' },
    ],
  },
  { label: 'fratrie', conditions: [] },
];

describe('POST /api/relationship-types/preview-label', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personCount.mockResolvedValue(2);
    mocks.personFindMany.mockResolvedValue([
      { id: 'p1', gender: 'Homme' },
      { id: 'p2', gender: 'Femme' },
    ]);
    mocks.personGroupFindMany.mockResolvedValue([]);
    mocks.customValueFindMany.mockResolvedValue([]);
    mocks.importantDateFindMany.mockResolvedValue([]);
  });

  it('resolves against the unsaved configuration', async () => {
    const response = await POST(
      request({ typeLabel: 'Frere/Soeur', describedPersonId: 'p1', otherPersonId: 'p2', variants })
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.label).toBe('frere');
    expect(body.variantIndex).toBe(0);
  });

  it('falls back when nothing matches', async () => {
    const response = await POST(
      request({ typeLabel: 'Frere/Soeur', describedPersonId: 'p2', otherPersonId: 'p1', variants })
    );
    const body = await response.json();
    expect(body.label).toBe('fratrie');
  });

  it('refuses people that do not belong to the user', async () => {
    mocks.personCount.mockResolvedValue(1);
    const response = await POST(
      request({ typeLabel: 'x', describedPersonId: 'p1', otherPersonId: 'stranger', variants })
    );
    expect(response.status).toBe(404);
    // The ownership check must run before any data is loaded, so a reordering
    // that still returned 404 after a wasted read would fail here.
    expect(mocks.personFindMany).not.toHaveBeenCalled();
    expect(mocks.personGroupFindMany).not.toHaveBeenCalled();
    expect(mocks.customValueFindMany).not.toHaveBeenCalled();
    expect(mocks.importantDateFindMany).not.toHaveBeenCalled();
  });

  it('rejects an invalid configuration', async () => {
    const response = await POST(
      request({
        typeLabel: 'x',
        describedPersonId: 'p1',
        otherPersonId: 'p2',
        variants: [{ label: 'a', conditions: [] }, { label: 'b', conditions: [] }],
      })
    );
    expect(response.status).toBe(400);
  });
});
