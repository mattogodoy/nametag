import { describe, it, expect, beforeEach, vi } from 'vitest';

// Both the export and import routes import from 'lib/prisma' (via different
// path spellings that resolve to the same module), so this file registers a
// single merged mock covering everything either route touches. Two separate
// vi.mock calls for the same resolved module would silently let the second
// registration clobber the first.
const exportMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  groupFindMany: vi.fn(),
  relationshipTypeFindMany: vi.fn(),
  journalEntryFindMany: vi.fn(),
  customFieldTemplateFindMany: vi.fn(),
}));

const importMocks = vi.hoisted(() => ({
  relTypeFindFirst: vi.fn(),
  relTypeCreate: vi.fn(),
  relTypeUpdate: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateCreate: vi.fn(),
  templateCount: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  personGroupFindUnique: vi.fn(),
  personGroupCreate: vi.fn(),
  journalEntryFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  personCount: vi.fn(),
  groupCount: vi.fn(),
  importantDateCount: vi.fn(),
  variantDeleteMany: vi.fn(),
  variantCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: { findUnique: exportMocks.userFindUnique },
    person: {
      findMany: exportMocks.personFindMany,
      findFirst: importMocks.personFindFirst,
      create: importMocks.personCreate,
      count: importMocks.personCount,
    },
    group: {
      findMany: exportMocks.groupFindMany,
      findFirst: importMocks.groupFindFirst,
      create: importMocks.groupCreate,
      count: importMocks.groupCount,
    },
    relationshipType: {
      findMany: exportMocks.relationshipTypeFindMany,
      findFirst: importMocks.relTypeFindFirst,
      create: importMocks.relTypeCreate,
      update: importMocks.relTypeUpdate,
    },
    journalEntry: {
      findMany: exportMocks.journalEntryFindMany,
      findFirst: importMocks.journalEntryFindFirst,
    },
    customFieldTemplate: {
      findMany: exportMocks.customFieldTemplateFindMany,
      findFirst: importMocks.templateFindFirst,
      create: importMocks.templateCreate,
      count: importMocks.templateCount,
    },
    personGroup: {
      findUnique: importMocks.personGroupFindUnique,
      create: importMocks.personGroupCreate,
    },
    importantDate: {
      count: importMocks.importantDateCount,
    },
    subscription: {
      findUnique: importMocks.subscriptionFindUnique,
    },
    relationshipLabelVariant: {
      deleteMany: importMocks.variantDeleteMany,
      create: importMocks.variantCreate,
    },
    $transaction: importMocks.transaction,
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'test@example.com', name: 'Test' } })
  ),
}));

vi.mock('../../lib/features', () => ({
  isSaasMode: vi.fn(() => false),
}));

import { GET as exportData } from '../../app/api/user/export/route';
import { POST as importRoute } from '../../app/api/user/import/route';

describe('Export API: relationship label variants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exportMocks.userFindUnique.mockResolvedValue({
      email: 'test@example.com',
      name: 'Test User',
      theme: 'DARK',
      dateFormat: 'MDY',
      createdAt: new Date('2024-01-01'),
    });
    exportMocks.personFindMany.mockResolvedValue([]);
    exportMocks.groupFindMany.mockResolvedValue([]);
    exportMocks.journalEntryFindMany.mockResolvedValue([]);
    exportMocks.customFieldTemplateFindMany.mockResolvedValue([
      { id: 'tpl-diet', name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan'], order: 0 },
    ]);
  });

  it('includes each relationship type\'s variants with their conditions, in order', async () => {
    exportMocks.relationshipTypeFindMany.mockResolvedValue([
      {
        id: 'type-1',
        name: 'PARENT',
        label: 'Parent',
        color: '#FF00FF',
        inverseId: null,
        labelVariants: [
          {
            label: 'Papa',
            conditions: [
              {
                subject: 'DESCRIBED',
                source: 'PERSON_FIELD',
                subjectRef: 'gender',
                operator: 'IS',
                operand: 'lit:Homme',
              },
            ],
          },
          {
            label: 'Maman',
            conditions: [],
          },
        ],
      },
    ]);

    const request = new Request('http://localhost/api/user/export', { method: 'GET' });
    const response = await exportData(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const type1 = body.relationshipTypes.find((t: { id: string }) => t.id === 'type-1');
    expect(type1.label).toBe('Parent');
    expect(type1.variants).toEqual([
      {
        label: 'Papa',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'PERSON_FIELD',
            subjectRef: 'gender',
            operator: 'IS',
            operand: 'lit:Homme',
          },
        ],
      },
      { label: 'Maman', conditions: [] },
    ]);
  });

  it('exports the type\'s own label on a relationship, never a resolved word', async () => {
    exportMocks.relationshipTypeFindMany.mockResolvedValue([
      {
        id: 'type-1',
        name: 'PARENT',
        label: 'Parent',
        color: '#FF00FF',
        inverseId: null,
        labelVariants: [],
      },
    ]);
    exportMocks.personFindMany.mockResolvedValue([
      {
        id: 'person-1',
        name: 'John',
        middleName: null,
        secondLastName: null,
        surname: 'Doe',
        nickname: null,
        displayNameOverride: null,
        prefix: null,
        suffix: null,
        organization: null,
        jobTitle: null,
        photo: null,
        gender: null,
        anniversary: null,
        lastContact: null,
        notes: null,
        contactReminderEnabled: false,
        contactReminderInterval: null,
        contactReminderIntervalUnit: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            relatedPersonId: 'person-2',
            relatedPerson: { id: 'person-2', name: 'Jane', surname: 'Doe', nickname: null },
            relationshipType: { id: 'type-1', name: 'PARENT', label: 'Parent' },
            notes: null,
          },
        ],
        importantDates: [],
        phoneNumbers: [],
        emails: [],
        addresses: [],
        urls: [],
        imHandles: [],
        locations: [],
        customFields: [],
        customFieldValues: [],
      },
      {
        id: 'person-2',
        name: 'Jane',
        middleName: null,
        secondLastName: null,
        surname: 'Doe',
        nickname: null,
        displayNameOverride: null,
        prefix: null,
        suffix: null,
        organization: null,
        jobTitle: null,
        photo: null,
        gender: null,
        anniversary: null,
        lastContact: null,
        notes: null,
        contactReminderEnabled: false,
        contactReminderInterval: null,
        contactReminderIntervalUnit: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [],
        importantDates: [],
        phoneNumbers: [],
        emails: [],
        addresses: [],
        urls: [],
        imHandles: [],
        locations: [],
        customFields: [],
        customFieldValues: [],
      },
    ]);

    const request = new Request('http://localhost/api/user/export', { method: 'GET' });
    const response = await exportData(request);
    const body = await response.json();

    const person1 = body.people.find((p: { id: string }) => p.id === 'person-1');
    expect(person1.relationships[0].relationshipType.label).toBe('Parent');
  });

  it('remains stable when a type has no labelVariants field (older export shape)', async () => {
    exportMocks.relationshipTypeFindMany.mockResolvedValue([
      { id: 'type-1', name: 'FRIEND', label: 'Friend', color: '#FFFFFF', inverseId: null },
    ]);

    const request = new Request('http://localhost/api/user/export', { method: 'GET' });
    const response = await exportData(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.relationshipTypes[0].variants).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Import tests
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_PAYLOAD = {
  version: '1.1',
  exportDate: '2026-01-01T00:00:00.000Z',
  people: [],
  journalEntries: [],
};

const genderCondition = {
  subject: 'DESCRIBED',
  source: 'PERSON_FIELD',
  subjectRef: 'gender',
  operator: 'IS',
  operand: 'lit:Homme',
};

describe('Import: relationship label variants', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    importMocks.relTypeCreate.mockResolvedValue({ id: 'new-type-1' });
    importMocks.relTypeUpdate.mockResolvedValue({});
    importMocks.templateFindFirst.mockResolvedValue(null);
    importMocks.templateFindMany.mockResolvedValue([]);
    importMocks.templateCreate.mockResolvedValue({ id: 'new-tpl-1' });
    importMocks.templateCount.mockResolvedValue(0);
    importMocks.groupFindFirst.mockResolvedValue(null);
    importMocks.groupCreate.mockResolvedValue({ id: 'new-group-1' });
    importMocks.personFindFirst.mockResolvedValue(null);
    importMocks.personCreate.mockResolvedValue({ id: 'new-person-1' });
    importMocks.personGroupFindUnique.mockResolvedValue(null);
    importMocks.personGroupCreate.mockResolvedValue({});
    importMocks.journalEntryFindFirst.mockResolvedValue(null);
    importMocks.personCount.mockResolvedValue(0);
    importMocks.groupCount.mockResolvedValue(0);
    importMocks.importantDateCount.mockResolvedValue(0);
    importMocks.variantDeleteMany.mockResolvedValue({ count: 0 });
    importMocks.variantCreate.mockResolvedValue({ id: 'v1' });
    importMocks.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        relationshipLabelVariant: {
          deleteMany: importMocks.variantDeleteMany,
          create: importMocks.variantCreate,
        },
      })
    );
  });

  it('recreates variants, remapping groupId and templateId references to the newly created entities', async () => {
    importMocks.relTypeFindFirst.mockResolvedValue(null); // no existing type
    importMocks.groupFindFirst.mockResolvedValue(null); // no existing group
    importMocks.groupCreate.mockResolvedValue({ id: 'imported-group-1' });
    importMocks.templateFindFirst.mockResolvedValue(null); // no existing template
    importMocks.templateCreate.mockResolvedValue({ id: 'imported-tpl-1', type: 'SELECT', options: ['vegan'] });
    importMocks.relTypeCreate.mockResolvedValue({ id: 'imported-type-1' });

    const payload = {
      ...BASE_PAYLOAD,
      groups: [{ id: 'old-group-1', name: 'Family', description: null, color: '#FF0000' }],
      customFieldTemplates: [
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan'], order: 0 },
      ],
      relationshipTypes: [
        {
          id: 'old-type-1',
          name: 'PARENT',
          label: 'Parent',
          color: '#FF00FF',
          inverseId: null,
          variants: [
            {
              label: 'Papa qui aime le vegan',
              conditions: [
                {
                  subject: 'DESCRIBED',
                  source: 'GROUP',
                  subjectRef: 'old-group-1',
                  operator: 'IN_GROUP',
                  operand: null,
                },
                {
                  subject: 'DESCRIBED',
                  source: 'CUSTOM_FIELD',
                  subjectRef: 'diet',
                  operator: 'IS',
                  operand: 'lit:vegan',
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    expect(importMocks.variantDeleteMany).toHaveBeenCalledWith({
      where: { relationshipTypeId: 'imported-type-1' },
    });
    expect(importMocks.variantCreate).toHaveBeenCalledTimes(1);
    const createCall = importMocks.variantCreate.mock.calls[0][0];
    expect(createCall.data.label).toBe('Papa qui aime le vegan');
    expect(createCall.data.conditions.create).toHaveLength(2);
    const [groupCondition, customFieldCondition] = createCall.data.conditions.create;
    expect(groupCondition.subjectRef).toBe('imported-group-1');
    expect(customFieldCondition.subjectRef).toBe('imported-tpl-1');
  });

  it('drops a condition whose referenced group was not part of the import, and keeps the rest of the variant', async () => {
    importMocks.relTypeFindFirst.mockResolvedValue(null);
    importMocks.relTypeCreate.mockResolvedValue({ id: 'imported-type-1' });

    const payload = {
      ...BASE_PAYLOAD,
      // The group the condition points at ('old-group-not-included') is
      // deliberately absent from this import's groups array.
      groups: [],
      relationshipTypes: [
        {
          id: 'old-type-1',
          name: 'PARENT',
          label: 'Parent',
          color: '#FF00FF',
          inverseId: null,
          variants: [
            {
              label: 'Papa du club',
              conditions: [
                {
                  subject: 'DESCRIBED',
                  source: 'GROUP',
                  subjectRef: 'old-group-not-included',
                  operator: 'IN_GROUP',
                  operand: null,
                },
                genderCondition,
              ],
            },
          ],
        },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // The whole import must not fail.
    expect(importMocks.variantCreate).toHaveBeenCalledTimes(1);
    const createCall = importMocks.variantCreate.mock.calls[0][0];
    // The variant itself survives...
    expect(createCall.data.label).toBe('Papa du club');
    // ...but only the mappable condition remains.
    expect(createCall.data.conditions.create).toHaveLength(1);
    expect(createCall.data.conditions.create[0].subjectRef).toBe('gender');
  });

  it('drops a variant whose only condition becomes unmappable, and keeps the surviving variants in order with the fallback last', async () => {
    importMocks.relTypeFindFirst.mockResolvedValue(null);
    importMocks.relTypeCreate.mockResolvedValue({ id: 'imported-type-1' });

    const payload = {
      ...BASE_PAYLOAD,
      // The group the first variant's only condition points at is
      // deliberately absent from this import's groups array.
      groups: [],
      relationshipTypes: [
        {
          id: 'old-type-1',
          name: 'PARENT',
          label: 'Parent',
          color: '#FF00FF',
          inverseId: null,
          variants: [
            {
              label: 'Papa du club',
              conditions: [
                {
                  subject: 'DESCRIBED',
                  source: 'GROUP',
                  subjectRef: 'old-group-not-included',
                  operator: 'IN_GROUP',
                  operand: null,
                },
              ],
            },
            { label: 'Maman', conditions: [genderCondition] },
            { label: 'Parent', conditions: [] },
          ],
        },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // A zero-condition variant matches unconditionally, so writing the
    // fully-emptied 'Papa du club' variant would shadow every variant
    // after it, including the real fallback. It must be dropped whole,
    // not written with an empty conditions array.
    expect(importMocks.variantCreate).toHaveBeenCalledTimes(2);
    const labels = importMocks.variantCreate.mock.calls.map((call) => call[0].data.label);
    expect(labels).not.toContain('Papa du club');
    expect(labels).toEqual(['Maman', 'Parent']);
    expect(importMocks.variantCreate.mock.calls[0][0].data.order).toBe(0);
    expect(importMocks.variantCreate.mock.calls[1][0].data.order).toBe(1);
  });

  it('keeps the real fallback variant when every other variant in the type loses all its conditions', async () => {
    importMocks.relTypeFindFirst.mockResolvedValue(null);
    importMocks.relTypeCreate.mockResolvedValue({ id: 'imported-type-1' });

    const payload = {
      ...BASE_PAYLOAD,
      // Neither referenced group is part of this import, so both
      // conditioned variants lose their only condition.
      groups: [],
      relationshipTypes: [
        {
          id: 'old-type-1',
          name: 'PARENT',
          label: 'Parent',
          color: '#FF00FF',
          inverseId: null,
          variants: [
            {
              label: 'Papa du club',
              conditions: [
                {
                  subject: 'DESCRIBED',
                  source: 'GROUP',
                  subjectRef: 'old-group-not-included',
                  operator: 'IN_GROUP',
                  operand: null,
                },
              ],
            },
            {
              label: 'Maman du club',
              conditions: [
                {
                  subject: 'DESCRIBED',
                  source: 'GROUP',
                  subjectRef: 'another-old-group-not-included',
                  operator: 'IN_GROUP',
                  operand: null,
                },
              ],
            },
            // This is the real fallback: it arrives with no conditions of
            // its own, and must survive even though it is the last variant
            // and everything ahead of it just got dropped.
            { label: 'Parent', conditions: [] },
          ],
        },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    expect(importMocks.variantCreate).toHaveBeenCalledTimes(1);
    const createCall = importMocks.variantCreate.mock.calls[0][0];
    expect(createCall.data.label).toBe('Parent');
    expect(createCall.data.conditions.create).toHaveLength(0);
  });

  it('does not touch variants when the relationship type carries none', async () => {
    importMocks.relTypeFindFirst.mockResolvedValue(null);
    importMocks.relTypeCreate.mockResolvedValue({ id: 'imported-type-1' });

    const payload = {
      ...BASE_PAYLOAD,
      groups: [],
      relationshipTypes: [
        { id: 'old-type-1', name: 'FRIEND', label: 'Friend', color: '#FFFFFF', inverseId: null },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);
    expect(importMocks.variantCreate).not.toHaveBeenCalled();
    expect(importMocks.variantDeleteMany).not.toHaveBeenCalled();
  });
});
