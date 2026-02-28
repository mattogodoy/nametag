import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  groupFindMany: vi.fn(),
  relationshipTypeFindMany: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    person: {
      findMany: mocks.personFindMany,
    },
    group: {
      findMany: mocks.groupFindMany,
    },
    relationshipType: {
      findMany: mocks.relationshipTypeFindMany,
    },
  },
}));

// Mock auth
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Import after mocking
import { GET as exportData } from '../../app/api/user/export/route';

describe('Export API', () => {
  const mockUser = {
    email: 'test@example.com',
    name: 'Test User',
    theme: 'DARK',
    dateFormat: 'MDY',
    createdAt: new Date('2024-01-01'),
  };

  const mockGroups = [
    { id: 'group-1', name: 'Family', description: 'Family members', color: '#FF0000' },
    { id: 'group-2', name: 'Friends', description: 'Close friends', color: '#00FF00' },
    { id: 'group-3', name: 'Work', description: 'Colleagues', color: '#0000FF' },
  ];

  const emptyMultiValues = {
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    customFields: [],
  };

  const nullPersonFields = {
    secondLastName: null,
    prefix: null,
    suffix: null,
    organization: null,
    jobTitle: null,
    photo: null,
    gender: null,
    anniversary: null,
    contactReminderEnabled: false,
    contactReminderInterval: null,
    contactReminderIntervalUnit: null,
  };

  const mockPeople = [
    {
      id: 'person-1',
      name: 'John',
      middleName: 'Michael',
      surname: 'Doe',
      nickname: null,
      lastContact: null,
      notes: null,
      ...nullPersonFields,
      prefix: 'Dr.',
      organization: 'Acme Corp',
      jobTitle: 'Engineer',
      relationshipToUser: { id: 'rel-1', name: 'friend', label: 'Friend' },
      groups: [
        { group: { id: 'group-1', name: 'Family' } },
        { group: { id: 'group-2', name: 'Friends' } },
      ],
      relationshipsFrom: [
        {
          relatedPersonId: 'person-2',
          relatedPerson: { id: 'person-2', name: 'Jane', surname: 'Doe', nickname: null },
          relationshipType: { id: 'type-1', name: 'spouse', label: 'Spouse' },
          notes: null,
        },
      ],
      importantDates: [
        { title: 'Birthday', date: new Date('1990-05-15') },
        { title: 'Anniversary', date: new Date('2015-06-20') },
      ],
      phoneNumbers: [{ type: 'mobile', number: '+1234567890' }],
      emails: [{ type: 'work', email: 'john@acme.com' }],
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
      urls: [{ type: 'homepage', url: 'https://johndoe.com' }],
      imHandles: [{ protocol: 'telegram', handle: '@johndoe' }],
      locations: [{ type: 'home', latitude: 39.7817, longitude: -89.6501, label: 'Home' }],
      customFields: [{ key: 'X-HOBBY', value: 'Guitar', type: null }],
    },
    {
      id: 'person-2',
      name: 'Jane',
      middleName: null,
      surname: 'Doe',
      nickname: null,
      lastContact: null,
      notes: null,
      ...nullPersonFields,
      relationshipToUser: null,
      groups: [{ group: { id: 'group-1', name: 'Family' } }],
      relationshipsFrom: [
        {
          relatedPersonId: 'person-1',
          relatedPerson: { id: 'person-1', name: 'John', surname: 'Doe', nickname: null },
          relationshipType: { id: 'type-1', name: 'spouse', label: 'Spouse' },
          notes: null,
        },
      ],
      importantDates: [],
      ...emptyMultiValues,
    },
    {
      id: 'person-3',
      name: 'Bob',
      middleName: null,
      surname: 'Smith',
      nickname: 'Bobby',
      lastContact: null,
      notes: null,
      ...nullPersonFields,
      relationshipToUser: null,
      groups: [{ group: { id: 'group-3', name: 'Work' } }],
      relationshipsFrom: [],
      importantDates: [{ title: 'Birthday', date: new Date('1985-12-25') }],
      ...emptyMultiValues,
    },
  ];

  const mockRelationshipTypes = [
    { id: 'type-1', name: 'spouse', label: 'Spouse', color: '#FF00FF', inverseId: 'type-1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindUnique.mockResolvedValue(mockUser);
    mocks.groupFindMany.mockResolvedValue(mockGroups);
    mocks.relationshipTypeFindMany.mockResolvedValue(mockRelationshipTypes);
  });

  describe('GET /api/user/export', () => {
    it('should export all data when no groupIds filter is provided', async () => {
      mocks.personFindMany.mockResolvedValue(mockPeople);

      const request = new Request('http://localhost/api/user/export', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.version).toBe('1.0');
      expect(body.people).toHaveLength(3);
      expect(body.groups).toHaveLength(3);
      expect(body.relationshipTypes).toHaveLength(1);
    });

    it('should filter people by group when groupIds is provided', async () => {
      // When filtering by group-1 (Family), only person-1 and person-2 should be returned
      const familyPeople = mockPeople.filter((p) =>
        p.groups.some((g) => g.group.id === 'group-1')
      );
      mocks.personFindMany.mockResolvedValue(familyPeople);

      const request = new Request('http://localhost/api/user/export?groupIds=group-1', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.people).toHaveLength(2);
      expect(body.people.map((p: { id: string }) => p.id)).toContain('person-1');
      expect(body.people.map((p: { id: string }) => p.id)).toContain('person-2');
      expect(body.people.map((p: { id: string }) => p.id)).not.toContain('person-3');
    });

    it('should only export specified groups, not all groups people belong to', async () => {
      // Person-1 belongs to both Family and Friends, but if we only export Family,
      // the Friends group should not be in the exported groups
      const familyPeople = mockPeople.filter((p) =>
        p.groups.some((g) => g.group.id === 'group-1')
      );
      mocks.personFindMany.mockResolvedValue(familyPeople);

      const request = new Request('http://localhost/api/user/export?groupIds=group-1', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      // Only the Family group should be exported
      expect(body.groups).toHaveLength(1);
      expect(body.groups[0].name).toBe('Family');
      // Person-1's groups should only show Family, not Friends
      const person1 = body.people.find((p: { id: string }) => p.id === 'person-1');
      expect(person1.groups).toEqual(['Family']);
      expect(person1.groups).not.toContain('Friends');
    });

    it('should filter relationships to only include those between exported people', async () => {
      // When filtering by group-3 (Work), only person-3 is included
      // person-3 has no relationships with other people in Work group
      const workPeople = mockPeople.filter((p) =>
        p.groups.some((g) => g.group.id === 'group-3')
      );
      mocks.personFindMany.mockResolvedValue(workPeople);

      const request = new Request('http://localhost/api/user/export?groupIds=group-3', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.people).toHaveLength(1);
      expect(body.people[0].id).toBe('person-3');
      expect(body.people[0].relationships).toHaveLength(0);
    });

    it('should support multiple group IDs', async () => {
      // Export both Family and Work groups
      const filteredPeople = mockPeople.filter((p) =>
        p.groups.some((g) => g.group.id === 'group-1' || g.group.id === 'group-3')
      );
      mocks.personFindMany.mockResolvedValue(filteredPeople);

      const request = new Request('http://localhost/api/user/export?groupIds=group-1,group-3', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.people).toHaveLength(3);
      expect(body.groups).toHaveLength(2);
      expect(body.groups.map((g: { name: string }) => g.name)).toContain('Family');
      expect(body.groups.map((g: { name: string }) => g.name)).toContain('Work');
      expect(body.groups.map((g: { name: string }) => g.name)).not.toContain('Friends');
    });

    it('should include relationships between people in the same exported groups', async () => {
      // When exporting Family group, person-1 and person-2 both belong to it
      // Their spouse relationship should be included
      const familyPeople = mockPeople.filter((p) =>
        p.groups.some((g) => g.group.id === 'group-1')
      );
      mocks.personFindMany.mockResolvedValue(familyPeople);

      const request = new Request('http://localhost/api/user/export?groupIds=group-1', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      const person1 = body.people.find((p: { id: string }) => p.id === 'person-1');
      expect(person1.relationships).toHaveLength(1);
      expect(person1.relationships[0].relatedPersonId).toBe('person-2');
    });

    it('should include all person fields in export', async () => {
      mocks.personFindMany.mockResolvedValue(mockPeople);

      const request = new Request('http://localhost/api/user/export', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);

      const person1 = body.people.find((p: { id: string }) => p.id === 'person-1');

      // Scalar fields
      expect(person1.middleName).toBe('Michael');
      expect(person1.prefix).toBe('Dr.');
      expect(person1.organization).toBe('Acme Corp');
      expect(person1.jobTitle).toBe('Engineer');
      expect(person1.secondLastName).toBeNull();
      expect(person1.suffix).toBeNull();
      expect(person1.photo).toBeNull();
      expect(person1.gender).toBeNull();
      expect(person1.anniversary).toBeNull();
      expect(person1.contactReminderEnabled).toBe(false);
      expect(person1.contactReminderInterval).toBeNull();
      expect(person1.contactReminderIntervalUnit).toBeNull();

      // Important dates
      expect(person1.importantDates).toHaveLength(2);
      expect(person1.importantDates[0].title).toBe('Birthday');

      // Multi-value fields
      expect(person1.phoneNumbers).toEqual([{ type: 'mobile', number: '+1234567890' }]);
      expect(person1.emails).toEqual([{ type: 'work', email: 'john@acme.com' }]);
      expect(person1.addresses).toEqual([
        {
          type: 'home',
          streetLine1: '123 Main St',
          streetLine2: 'Apt 4',
          locality: 'Springfield',
          region: 'IL',
          postalCode: '62701',
          country: 'US',
        },
      ]);
      expect(person1.urls).toEqual([{ type: 'homepage', url: 'https://johndoe.com' }]);
      expect(person1.imHandles).toEqual([{ protocol: 'telegram', handle: '@johndoe' }]);
      expect(person1.locations).toHaveLength(1);
      expect(person1.locations[0].label).toBe('Home');
      expect(person1.customFields).toEqual([{ key: 'X-HOBBY', value: 'Guitar', type: null }]);

      // Person with empty multi-value fields
      const person2 = body.people.find((p: { id: string }) => p.id === 'person-2');
      expect(person2.middleName).toBeNull();
      expect(person2.importantDates).toHaveLength(0);
      expect(person2.phoneNumbers).toHaveLength(0);
      expect(person2.emails).toHaveLength(0);
      expect(person2.addresses).toHaveLength(0);
      expect(person2.urls).toHaveLength(0);
      expect(person2.imHandles).toHaveLength(0);
      expect(person2.locations).toHaveLength(0);
      expect(person2.customFields).toHaveLength(0);
    });

    it('should return empty people array when no people match the group filter', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export?groupIds=non-existent-group', {
        method: 'GET',
      });

      const response = await exportData(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.people).toHaveLength(0);
      expect(body.groups).toHaveLength(0);
    });
  });
});
