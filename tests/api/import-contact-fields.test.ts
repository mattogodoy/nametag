import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionTier } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  personCount: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  groupCount: vi.fn(),
  personGroupFindUnique: vi.fn(),
  personGroupCreate: vi.fn(),
  relTypeFindFirst: vi.fn(),
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
  journalEntryFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  importantDateCount: vi.fn(),
  templateCount: vi.fn(),
  templateFindMany: vi.fn(),
  templateFindFirst: vi.fn(),
  templateCreate: vi.fn(),
  cfvUpsert: vi.fn(),
  phoneCreateMany: vi.fn(),
  emailCreateMany: vi.fn(),
  addressCreateMany: vi.fn(),
  urlCreateMany: vi.fn(),
  imCreateMany: vi.fn(),
  locationCreateMany: vi.fn(),
  importantDateCreateMany: vi.fn(),
  customFieldCreateMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      create: mocks.personCreate,
      count: mocks.personCount,
    },
    group: {
      findFirst: mocks.groupFindFirst,
      create: mocks.groupCreate,
      count: mocks.groupCount,
    },
    personGroup: {
      findUnique: mocks.personGroupFindUnique,
      create: mocks.personGroupCreate,
    },
    relationshipType: {
      findFirst: mocks.relTypeFindFirst,
    },
    relationship: {
      findFirst: mocks.relationshipFindFirst,
      create: mocks.relationshipCreate,
    },
    journalEntry: {
      findFirst: mocks.journalEntryFindFirst,
    },
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
    importantDate: {
      count: mocks.importantDateCount,
      createMany: mocks.importantDateCreateMany,
    },
    customFieldTemplate: {
      count: mocks.templateCount,
      findMany: mocks.templateFindMany,
      findFirst: mocks.templateFindFirst,
      create: mocks.templateCreate,
    },
    personCustomFieldValue: {
      upsert: mocks.cfvUpsert,
    },
    personPhone: {
      createMany: mocks.phoneCreateMany,
    },
    personEmail: {
      createMany: mocks.emailCreateMany,
    },
    personAddress: {
      createMany: mocks.addressCreateMany,
    },
    personUrl: {
      createMany: mocks.urlCreateMany,
    },
    personIM: {
      createMany: mocks.imCreateMany,
    },
    personLocation: {
      createMany: mocks.locationCreateMany,
    },
    personCustomField: {
      createMany: mocks.customFieldCreateMany,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/features', () => ({
  isSaasMode: vi.fn(() => true),
}));

import { POST as importRoute } from '../../app/api/user/import/route';

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
  groups: [],
  relationships: [],
  relationshipTypes: [],
  journalEntries: [],
};

describe('Import - contact fields round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.personFindFirst.mockResolvedValue(null);
    mocks.personCreate.mockResolvedValue({ id: 'new-person-1' });
    mocks.groupFindFirst.mockResolvedValue(null);
    mocks.groupCreate.mockResolvedValue({ id: 'new-group-1' });
    mocks.personGroupFindUnique.mockResolvedValue(null);
    mocks.personGroupCreate.mockResolvedValue({});
    mocks.relTypeFindFirst.mockResolvedValue(null);
    mocks.relationshipFindFirst.mockResolvedValue(null);
    mocks.journalEntryFindFirst.mockResolvedValue(null);
    mocks.importantDateCount.mockResolvedValue(0);
    mocks.templateCount.mockResolvedValue(0);
    mocks.templateFindMany.mockResolvedValue([]);
    mocks.templateFindFirst.mockResolvedValue(null);
    mocks.cfvUpsert.mockResolvedValue({});
    mocks.phoneCreateMany.mockResolvedValue({ count: 0 });
    mocks.emailCreateMany.mockResolvedValue({ count: 0 });
    mocks.addressCreateMany.mockResolvedValue({ count: 0 });
    mocks.urlCreateMany.mockResolvedValue({ count: 0 });
    mocks.imCreateMany.mockResolvedValue({ count: 0 });
    mocks.locationCreateMany.mockResolvedValue({ count: 0 });
    mocks.importantDateCreateMany.mockResolvedValue({ count: 0 });
    mocks.customFieldCreateMany.mockResolvedValue({ count: 0 });

    mocks.subscriptionFindUnique.mockResolvedValue({
      userId: 'user-123',
      tier: SubscriptionTier.PRO,
      status: 'ACTIVE',
      promotion: null,
    });
    mocks.personCount.mockResolvedValue(0);
    mocks.groupCount.mockResolvedValue(0);
  });

  describe('scalar person fields', () => {
    it('imports all scalar fields when creating a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            surname: 'Smith',
            middleName: 'Marie',
            secondLastName: 'Garcia',
            nickname: 'Ali',
            prefix: 'Dr.',
            suffix: 'Jr.',
            organization: 'Acme Corp',
            jobTitle: 'Engineer',
            photo: 'https://example.com/photo.jpg',
            gender: 'female',
            anniversary: '2020-06-15T00:00:00.000Z',
            lastContact: '2026-01-01T00:00:00.000Z',
            notes: 'Some notes',
            contactReminderEnabled: true,
            contactReminderInterval: 30,
            contactReminderIntervalUnit: 'DAYS',
            groups: [],
            relationships: [],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.personCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Alice',
            surname: 'Smith',
            middleName: 'Marie',
            secondLastName: 'Garcia',
            nickname: 'Ali',
            prefix: 'Dr.',
            suffix: 'Jr.',
            organization: 'Acme Corp',
            jobTitle: 'Engineer',
            photo: 'https://example.com/photo.jpg',
            gender: 'female',
            anniversary: new Date('2020-06-15T00:00:00.000Z'),
            lastContact: new Date('2026-01-01T00:00:00.000Z'),
            notes: 'Some notes',
            contactReminderEnabled: true,
            contactReminderInterval: 30,
            contactReminderIntervalUnit: 'DAYS',
          }),
        })
      );
    });

    it('handles null/missing optional scalar fields gracefully', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Bob',
            groups: [],
            relationships: [],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);
      expect(mocks.personCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('phone numbers', () => {
    it('imports phone numbers for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            phoneNumbers: [
              { type: 'mobile', number: '+1234567890' },
              { type: 'work', number: '+0987654321' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.phoneCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', type: 'mobile', number: '+1234567890' },
          { personId: 'new-person-1', type: 'work', number: '+0987654321' },
        ],
      });
    });

    it('does not import phone numbers for an existing person', async () => {
      mocks.personFindFirst.mockResolvedValue({ id: 'existing-person-1' });

      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);
      expect(mocks.phoneCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('emails', () => {
    it('imports email addresses for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            emails: [
              { type: 'home', email: 'alice@example.com' },
              { type: 'work', email: 'alice@work.com' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.emailCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', type: 'home', email: 'alice@example.com' },
          { personId: 'new-person-1', type: 'work', email: 'alice@work.com' },
        ],
      });
    });
  });

  describe('addresses', () => {
    it('imports addresses for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            addresses: [
              {
                type: 'home',
                streetLine1: '123 Main St',
                streetLine2: 'Apt 4',
                locality: 'Springfield',
                region: 'IL',
                postalCode: '62701',
                country: 'US',
              },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.addressCreateMany).toHaveBeenCalledWith({
        data: [
          {
            personId: 'new-person-1',
            type: 'home',
            streetLine1: '123 Main St',
            streetLine2: 'Apt 4',
            locality: 'Springfield',
            region: 'IL',
            postalCode: '62701',
            country: 'US',
          },
        ],
      });
    });
  });

  describe('urls', () => {
    it('imports URLs for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            urls: [
              { type: 'homepage', url: 'https://alice.example.com' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.urlCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', type: 'homepage', url: 'https://alice.example.com' },
        ],
      });
    });
  });

  describe('IM handles', () => {
    it('imports IM handles for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            imHandles: [
              { protocol: 'telegram', handle: '@alice' },
              { protocol: 'signal', handle: '+1234567890' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.imCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', protocol: 'telegram', handle: '@alice' },
          { personId: 'new-person-1', protocol: 'signal', handle: '+1234567890' },
        ],
      });
    });
  });

  describe('locations', () => {
    it('imports locations for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            locations: [
              { type: 'home', latitude: 37.386013, longitude: -122.082932, label: 'Home' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.locationCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', type: 'home', latitude: 37.386013, longitude: -122.082932, label: 'Home' },
        ],
      });
    });
  });

  describe('important dates', () => {
    it('imports important dates for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            importantDates: [
              { title: 'Birthday', date: '1990-03-15T00:00:00.000Z' },
              { title: 'Anniversary', date: '2015-06-20T00:00:00.000Z' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.importantDateCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', title: 'Birthday', date: new Date('1990-03-15T00:00:00.000Z') },
          { personId: 'new-person-1', title: 'Anniversary', date: new Date('2015-06-20T00:00:00.000Z') },
        ],
      });
    });
  });

  describe('custom fields (X- properties)', () => {
    it('imports custom fields for a new person', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            customFields: [
              { key: 'X-SPOUSE', value: 'Bob', type: 'text' },
            ],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.customFieldCreateMany).toHaveBeenCalledWith({
        data: [
          { personId: 'new-person-1', key: 'X-SPOUSE', value: 'Bob', type: 'text' },
        ],
      });
    });
  });

  describe('existing person skips multi-value fields', () => {
    it('does not create any multi-value records for a matched existing person', async () => {
      mocks.personFindFirst.mockResolvedValue({ id: 'existing-person-1' });

      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            surname: 'Smith',
            groups: [],
            relationships: [],
            phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
            emails: [{ type: 'home', email: 'alice@example.com' }],
            addresses: [{ type: 'home', streetLine1: '123 Main St' }],
            urls: [{ type: 'homepage', url: 'https://alice.example.com' }],
            imHandles: [{ protocol: 'telegram', handle: '@alice' }],
            locations: [{ type: 'home', latitude: 0, longitude: 0 }],
            importantDates: [{ title: 'Birthday', date: '1990-01-01T00:00:00.000Z' }],
            customFields: [{ key: 'X-TEST', value: 'val' }],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.phoneCreateMany).not.toHaveBeenCalled();
      expect(mocks.emailCreateMany).not.toHaveBeenCalled();
      expect(mocks.addressCreateMany).not.toHaveBeenCalled();
      expect(mocks.urlCreateMany).not.toHaveBeenCalled();
      expect(mocks.imCreateMany).not.toHaveBeenCalled();
      expect(mocks.locationCreateMany).not.toHaveBeenCalled();
      expect(mocks.importantDateCreateMany).not.toHaveBeenCalled();
      expect(mocks.customFieldCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('empty arrays are not imported', () => {
    it('does not call createMany when arrays are empty', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            groups: [],
            relationships: [],
            phoneNumbers: [],
            emails: [],
            addresses: [],
            urls: [],
            imHandles: [],
            locations: [],
            importantDates: [],
            customFields: [],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.phoneCreateMany).not.toHaveBeenCalled();
      expect(mocks.emailCreateMany).not.toHaveBeenCalled();
      expect(mocks.addressCreateMany).not.toHaveBeenCalled();
      expect(mocks.urlCreateMany).not.toHaveBeenCalled();
      expect(mocks.imCreateMany).not.toHaveBeenCalled();
      expect(mocks.locationCreateMany).not.toHaveBeenCalled();
      expect(mocks.importantDateCreateMany).not.toHaveBeenCalled();
      expect(mocks.customFieldCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('backwards compatibility', () => {
    it('imports old exports that lack multi-value fields', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            surname: 'Smith',
            nickname: null,
            lastContact: null,
            notes: null,
            relationshipToUser: null,
            groups: [],
            relationships: [],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.personCreate).toHaveBeenCalledTimes(1);
      expect(mocks.phoneCreateMany).not.toHaveBeenCalled();
      expect(mocks.emailCreateMany).not.toHaveBeenCalled();
    });
  });

  describe('full round-trip', () => {
    it('imports a person with all contact field types', async () => {
      const payload = {
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'p1',
            name: 'Alice',
            surname: 'Smith',
            middleName: 'Marie',
            prefix: 'Dr.',
            organization: 'Acme Corp',
            jobTitle: 'Engineer',
            groups: [],
            relationships: [],
            phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
            emails: [{ type: 'work', email: 'alice@acme.com' }],
            addresses: [
              {
                type: 'work',
                streetLine1: '100 Tech Blvd',
                streetLine2: null,
                locality: 'San Francisco',
                region: 'CA',
                postalCode: '94105',
                country: 'US',
              },
            ],
            urls: [{ type: 'homepage', url: 'https://alice.dev' }],
            imHandles: [{ protocol: 'signal', handle: '+1234567890' }],
            locations: [{ type: 'work', latitude: 37.7749, longitude: -122.4194, label: 'Office' }],
            importantDates: [{ title: 'Birthday', date: '1990-03-15T00:00:00.000Z' }],
            customFields: [{ key: 'X-DEPARTMENT', value: 'Engineering', type: null }],
          },
        ],
      };

      const response = await importRoute(makeRequest(payload));
      expect(response.status).toBe(200);

      expect(mocks.personCreate).toHaveBeenCalledTimes(1);
      expect(mocks.phoneCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.emailCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.addressCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.urlCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.imCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.locationCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.importantDateCreateMany).toHaveBeenCalledTimes(1);
      expect(mocks.customFieldCreateMany).toHaveBeenCalledTimes(1);
    });
  });
});
