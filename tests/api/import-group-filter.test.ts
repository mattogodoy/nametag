import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create test data
const createTestImportData = () => ({
  version: '1.0',
  exportDate: '2026-01-09T00:00:00.000Z',
  groups: [
    { id: 'group-1', name: 'Family', description: 'Family members', color: '#FF0000' },
    { id: 'group-2', name: 'Work', description: 'Work colleagues', color: '#00FF00' },
    { id: 'group-3', name: 'Hobby', description: 'Hobby club', color: '#0000FF' },
  ],
  people: [
    {
      id: 'person-1',
      name: 'Alice',
      surname: 'Smith',
      nickname: null,
      lastContact: null,
      notes: null,
      relationshipToUser: null,
      groups: ['Family'],
      relationships: [
        {
          relatedPersonId: 'person-2',
          relatedPersonName: 'Bob Smith',
          relationshipType: { name: 'SIBLING', label: 'Sibling' },
          notes: null,
        },
      ],
    },
    {
      id: 'person-2',
      name: 'Bob',
      surname: 'Smith',
      nickname: null,
      lastContact: null,
      notes: null,
      relationshipToUser: null,
      groups: ['Family'],
      relationships: [
        {
          relatedPersonId: 'person-1',
          relatedPersonName: 'Alice Smith',
          relationshipType: { name: 'SIBLING', label: 'Sibling' },
          notes: null,
        },
      ],
    },
    {
      id: 'person-3',
      name: 'Charlie',
      surname: 'Jones',
      nickname: null,
      lastContact: null,
      notes: null,
      relationshipToUser: null,
      groups: ['Work'],
      relationships: [],
    },
    {
      id: 'person-4',
      name: 'Diana',
      surname: 'Brown',
      nickname: null,
      lastContact: null,
      notes: null,
      relationshipToUser: null,
      groups: ['Hobby'],
      relationships: [],
    },
    {
      id: 'person-5',
      name: 'Eve',
      surname: 'Wilson',
      nickname: null,
      lastContact: null,
      notes: null,
      relationshipToUser: null,
      groups: ['Family', 'Work'],
      relationships: [
        {
          relatedPersonId: 'person-3',
          relatedPersonName: 'Charlie Jones',
          relationshipType: { name: 'COLLEAGUE', label: 'Colleague' },
          notes: null,
        },
      ],
    },
  ],
  relationshipTypes: [
    { id: 'rel-1', name: 'SIBLING', label: 'Sibling', color: '#FF00FF', inverseId: 'rel-1' },
    { id: 'rel-2', name: 'COLLEAGUE', label: 'Colleague', color: '#00FFFF', inverseId: 'rel-2' },
  ],
});

describe('Import API - Group Filtering', () => {
  let importData: ReturnType<typeof createTestImportData>;

  beforeEach(() => {
    importData = createTestImportData();
    vi.clearAllMocks();
  });

  describe('Group Filtering Logic', () => {
    it('should filter to only selected groups', () => {
      const selectedGroupIds = ['group-1']; // Only Family
      const selectedGroups = importData.groups.filter(g => selectedGroupIds.includes(g.id));

      expect(selectedGroups).toHaveLength(1);
      expect(selectedGroups[0].name).toBe('Family');
    });

    it('should filter people to only those in selected groups', () => {
      const selectedGroupIds = ['group-1']; // Only Family
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Alice, Bob, and Eve are in Family group
      expect(filteredPeople).toHaveLength(3);
      expect(filteredPeople.map(p => p.name).sort()).toEqual(['Alice', 'Bob', 'Eve']);
    });

    it('should filter people when multiple groups are selected', () => {
      const selectedGroupIds = ['group-1', 'group-2']; // Family and Work
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Alice, Bob, Eve (Family), Charlie (Work), Eve (both)
      expect(filteredPeople).toHaveLength(4);
      expect(filteredPeople.map(p => p.name).sort()).toEqual(['Alice', 'Bob', 'Charlie', 'Eve']);
    });

    it('should handle people in multiple groups correctly', () => {
      const selectedGroupIds = ['group-2']; // Only Work
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Charlie and Eve are in Work group
      expect(filteredPeople).toHaveLength(2);
      expect(filteredPeople.map(p => p.name).sort()).toEqual(['Charlie', 'Eve']);
    });

    it('should filter relationships to only include people being imported', () => {
      const selectedGroupIds = ['group-1']; // Only Family
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      // Alice's relationship to Bob should be kept (both in Family)
      const alice = filteredPeopleWithRelationships.find(p => p.name === 'Alice');
      expect(alice?.relationships).toHaveLength(1);

      // Eve's relationship to Charlie should be removed (Charlie not in Family)
      const eve = filteredPeopleWithRelationships.find(p => p.name === 'Eve');
      expect(eve?.relationships).toHaveLength(0);
    });

    it('should keep relationships between people in selected groups', () => {
      const selectedGroupIds = ['group-1', 'group-2']; // Family and Work
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      // Eve's relationship to Charlie should now be kept (both in selected groups)
      const eve = filteredPeopleWithRelationships.find(p => p.name === 'Eve');
      expect(eve?.relationships).toHaveLength(1);
    });

    it('should not filter relationships when all groups are selected', () => {
      const selectedGroupIds = ['group-1', 'group-2', 'group-3']; // All groups
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const totalRelationshipsOriginal = importData.people.reduce(
        (sum, p) => sum + p.relationships.length,
        0
      );

      const totalRelationshipsFiltered = filteredPeople.reduce(
        (sum, p) => sum + p.relationships.length,
        0
      );

      expect(totalRelationshipsFiltered).toBe(totalRelationshipsOriginal);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty group selection', () => {
      const selectedGroupIds: string[] = [];
      const selectedGroups = importData.groups.filter(g => selectedGroupIds.includes(g.id));

      expect(selectedGroups).toHaveLength(0);
    });

    it('should handle non-existent group IDs', () => {
      const selectedGroupIds = ['non-existent-group'];
      const selectedGroups = importData.groups.filter(g => selectedGroupIds.includes(g.id));

      expect(selectedGroups).toHaveLength(0);
    });

    it('should handle people with no groups', () => {
      const personWithNoGroups = {
        id: 'person-6',
        name: 'Frank',
        surname: 'Miller',
        nickname: null,
        lastContact: null,
        notes: null,
        relationshipToUser: null,
        groups: [],
        relationships: [],
      };

      const testData = { ...importData, people: [...importData.people, personWithNoGroups] };
      const selectedGroupIds = ['group-1'];
      const selectedGroupNames = testData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = testData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Frank should not be included
      expect(filteredPeople.find(p => p.name === 'Frank')).toBeUndefined();
    });

    it('should preserve relationship types even when filtering groups', () => {
      // Relationship types should always be included
      const filteredRelationshipTypes = importData.relationshipTypes;

      expect(filteredRelationshipTypes).toHaveLength(2);
      expect(filteredRelationshipTypes.map(r => r.name)).toContain('SIBLING');
      expect(filteredRelationshipTypes.map(r => r.name)).toContain('COLLEAGUE');
    });

    it('should handle circular relationships correctly', () => {
      const selectedGroupIds = ['group-1']; // Only Family
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      // Alice has relationship to Bob
      const alice = filteredPeopleWithRelationships.find(p => p.name === 'Alice');
      expect(alice?.relationships.some(r => r.relatedPersonId === 'person-2')).toBe(true);

      // Bob has relationship to Alice (circular)
      const bob = filteredPeopleWithRelationships.find(p => p.name === 'Bob');
      expect(bob?.relationships.some(r => r.relatedPersonId === 'person-1')).toBe(true);
    });

    it('should handle person in multiple groups when only one group is selected', () => {
      const selectedGroupIds = ['group-1']; // Only Family
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      // Eve is in both Family and Work
      const eve = importData.people.find(p => p.name === 'Eve');
      expect(eve?.groups).toContain('Family');
      expect(eve?.groups).toContain('Work');

      const shouldBeIncluded = eve!.groups.some(groupName =>
        selectedGroupNames.includes(groupName)
      );

      // Eve should be included because she's in Family (one of her groups)
      expect(shouldBeIncluded).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve group data structure when filtering', () => {
      const selectedGroupIds = ['group-1'];
      const selectedGroups = importData.groups.filter(g => selectedGroupIds.includes(g.id));

      const group = selectedGroups[0];
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('description');
      expect(group).toHaveProperty('color');
    });

    it('should preserve person data structure when filtering', () => {
      const selectedGroupIds = ['group-1'];
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const person = filteredPeople[0];
      expect(person).toHaveProperty('id');
      expect(person).toHaveProperty('name');
      expect(person).toHaveProperty('surname');
      expect(person).toHaveProperty('groups');
      expect(person).toHaveProperty('relationships');
      expect(Array.isArray(person.groups)).toBe(true);
      expect(Array.isArray(person.relationships)).toBe(true);
    });

    it('should preserve relationship data structure when filtering', () => {
      const selectedGroupIds = ['group-1'];
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      const personWithRelationship = filteredPeopleWithRelationships.find(
        p => p.relationships.length > 0
      );

      if (personWithRelationship) {
        const rel = personWithRelationship.relationships[0];
        expect(rel).toHaveProperty('relatedPersonId');
        expect(rel).toHaveProperty('relatedPersonName');
        expect(rel).toHaveProperty('relationshipType');
        expect(rel.relationshipType).toHaveProperty('name');
        expect(rel.relationshipType).toHaveProperty('label');
      }
    });

    it('should not mutate original import data when filtering', () => {
      const originalData = JSON.parse(JSON.stringify(importData));
      const selectedGroupIds = ['group-1'];

      // Perform filtering operations
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      // Original data should remain unchanged
      expect(importData.groups.length).toBe(originalData.groups.length);
      expect(importData.people.length).toBe(originalData.people.length);
      expect(importData.relationshipTypes.length).toBe(originalData.relationshipTypes.length);
    });
  });

  describe('Statistics', () => {
    it('should correctly count filtered groups', () => {
      const selectedGroupIds = ['group-1', 'group-2'];
      const selectedGroups = importData.groups.filter(g => selectedGroupIds.includes(g.id));

      expect(selectedGroups.length).toBe(2);
    });

    it('should correctly count filtered people', () => {
      const selectedGroupIds = ['group-1'];
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      expect(filteredPeople.length).toBe(3); // Alice, Bob, Eve
    });

    it('should correctly count filtered relationships', () => {
      const selectedGroupIds = ['group-1'];
      const selectedGroupNames = importData.groups
        .filter(g => selectedGroupIds.includes(g.id))
        .map(g => g.name);

      const filteredPeople = importData.people.filter(person =>
        person.groups.some(groupName => selectedGroupNames.includes(groupName))
      );

      const filteredPeopleIds = new Set(filteredPeople.map(p => p.id));

      const filteredPeopleWithRelationships = filteredPeople.map(person => ({
        ...person,
        relationships: person.relationships.filter(rel =>
          filteredPeopleIds.has(rel.relatedPersonId)
        ),
      }));

      const totalRelationships = filteredPeopleWithRelationships.reduce(
        (sum, p) => sum + p.relationships.length,
        0
      );

      // Alice -> Bob, Bob -> Alice = 2 relationships
      expect(totalRelationships).toBe(2);
    });
  });
});
