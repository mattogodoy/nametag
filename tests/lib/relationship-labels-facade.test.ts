import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  variantFindMany: vi.fn(),
  personFindMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  customValueFindMany: vi.fn(),
  importantDateFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    relationshipLabelVariant: { findMany: mocks.variantFindMany },
    person: { findMany: mocks.personFindMany },
    personGroup: { findMany: mocks.personGroupFindMany },
    personCustomFieldValue: { findMany: mocks.customValueFindMany },
    importantDate: { findMany: mocks.importantDateFindMany },
  },
}));

import { createLabelResolver, loadLabelConfig } from '@/lib/relationship-labels';

const genderVariants = [
  {
    id: 'v1',
    relationshipTypeId: 'type-1',
    label: 'frere',
    order: 0,
    conditions: [
      {
        subject: 'DESCRIBED',
        source: 'PERSON_FIELD',
        subjectRef: 'gender',
        operator: 'IS',
        operand: 'lit:Homme',
        order: 0,
      },
    ],
  },
  {
    id: 'v2',
    relationshipTypeId: 'type-1',
    label: 'fratrie',
    order: 1,
    conditions: [],
  },
];

describe('loadLabelConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindMany.mockResolvedValue([]);
  });

  it('reports no conditions when the user configured nothing', async () => {
    mocks.variantFindMany.mockResolvedValue([]);
    const config = await loadLabelConfig('user-1');
    expect(config.hasConditions).toBe(false);
    expect(config.variantsByTypeId.size).toBe(0);
  });

  it('groups variants by type in order', async () => {
    mocks.variantFindMany.mockResolvedValue(genderVariants);
    const config = await loadLabelConfig('user-1');
    expect(config.hasConditions).toBe(true);
    expect(config.variantsByTypeId.get('type-1')?.map((v) => v.label)).toEqual(['frere', 'fratrie']);
  });
});

describe('createLabelResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindMany.mockResolvedValue([
      { id: 'p1', gender: 'Homme' },
      { id: 'p2', gender: 'Femme' },
    ]);
    mocks.personGroupFindMany.mockResolvedValue([]);
    mocks.customValueFindMany.mockResolvedValue([]);
    mocks.importantDateFindMany.mockResolvedValue([]);
  });

  it('loads no person data when no variant carries a condition', async () => {
    mocks.variantFindMany.mockResolvedValue([]);
    const resolver = await createLabelResolver('user-1', ['p1', 'p2']);
    expect(mocks.personFindMany).not.toHaveBeenCalled();
    expect(
      resolver.resolve({
        relationshipTypeId: 'type-1',
        typeLabel: 'Ami',
        describedPersonId: 'p1',
        otherPersonId: 'p2',
      })
    ).toEqual({ label: 'Ami', variantIndex: null });
  });

  it('resolves the matching variant', async () => {
    mocks.variantFindMany.mockResolvedValue(genderVariants);
    const resolver = await createLabelResolver('user-1', ['p1', 'p2']);
    expect(
      resolver.resolve({
        relationshipTypeId: 'type-1',
        typeLabel: 'Frere/Soeur',
        describedPersonId: 'p1',
        otherPersonId: 'p2',
      }).label
    ).toBe('frere');
    expect(
      resolver.resolve({
        relationshipTypeId: 'type-1',
        typeLabel: 'Frere/Soeur',
        describedPersonId: 'p2',
        otherPersonId: 'p1',
      }).label
    ).toBe('fratrie');
  });

  it('returns the type label for a type with no variants', async () => {
    mocks.variantFindMany.mockResolvedValue(genderVariants);
    const resolver = await createLabelResolver('user-1', ['p1']);
    expect(
      resolver.resolve({
        relationshipTypeId: 'type-9',
        typeLabel: 'Ami',
        describedPersonId: 'p1',
        otherPersonId: 'p1',
      }).label
    ).toBe('Ami');
  });

  it('uses the supplied user context for the account holder side', async () => {
    mocks.variantFindMany.mockResolvedValue([
      {
        id: 'v1',
        relationshipTypeId: 'type-1',
        label: 'fils',
        order: 0,
        conditions: [
          {
            subject: 'OTHER',
            source: 'PERSON_FIELD',
            subjectRef: 'name',
            operator: 'IS',
            operand: 'lit:Tristan',
            order: 0,
          },
        ],
      },
    ]);
    const resolver = await createLabelResolver('user-1', ['p1'], {
      userContext: {
        fields: { name: 'Tristan' },
        groupIds: new Set<string>(),
        customValues: new Map(),
        dates: [],
      },
    });
    expect(
      resolver.resolve({
        relationshipTypeId: 'type-1',
        typeLabel: 'Enfant',
        describedPersonId: 'p1',
        otherPersonId: 'USER',
      }).label
    ).toBe('fils');
  });

  it('resolves a null relationship type to the given label', async () => {
    mocks.variantFindMany.mockResolvedValue(genderVariants);
    const resolver = await createLabelResolver('user-1', ['p1']);
    expect(
      resolver.resolve({
        relationshipTypeId: null,
        typeLabel: 'Inconnu',
        describedPersonId: 'p1',
        otherPersonId: 'p1',
      }).label
    ).toBe('Inconnu');
  });
});
