import { describe, it, expect } from 'vitest';
import { createSearchIndex, searchIndex } from '@/lib/search-index';
import type { SearchDocument } from '@/lib/search-index';

const testDocuments: SearchDocument[] = [
  {
    id: '1',
    name: 'Maria',
    surname: 'Garcia',
    middleName: null,
    secondLastName: 'Lopez',
    nickname: null,
    organization: 'Acme Corp',
    jobTitle: 'Engineer',
    notes: 'Met at conference in Madrid',
    phones: '+34 612 345 678',
    emails: 'maria@acme.com',
    addresses: '123 Calle Mayor Madrid Spain',
    urls: 'https://linkedin.com/in/mariagarcia',
    imHandles: '',
    groups: 'Work Friends',
    customFields: '',
    photo: null,
  },
  {
    id: '2',
    name: 'John',
    surname: 'Smith',
    middleName: null,
    secondLastName: null,
    nickname: 'Johnny',
    displayNameOverride: 'Hatter',
    organization: 'Globex',
    jobTitle: 'Designer',
    notes: 'Lives in Berlin',
    phones: '+1 555 123 4567',
    emails: 'john@globex.com',
    addresses: '456 Hauptstrasse Berlin Germany',
    urls: '',
    imHandles: 'john_smith_telegram',
    groups: 'Friends',
    customFields: 'Spotify handle @johnsmith',
    photo: '/photos/john.jpg',
  },
];

describe('search-index', () => {
  describe('createSearchIndex', () => {
    it('should create an index from documents', () => {
      const index = createSearchIndex(testDocuments);
      expect(index).toBeDefined();
    });
  });

  describe('searchIndex', () => {
    it('should find people by name', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Maria');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should find people accent-insensitive', () => {
      const docs: SearchDocument[] = [{
        ...testDocuments[0],
        name: 'María',
        surname: 'García',
      }];
      const index = createSearchIndex(docs);
      const results = searchIndex(index, 'garcia');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should find people by organization', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Globex');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should find people by city in address', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Madrid');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should find people by notes content', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Berlin');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should find people by email domain', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'acme');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should find people by phone number fragment', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, '612');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('should find people by group name', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Work');
      expect(results.some((r) => r.id === '1')).toBe(true);
    });

    it('should find people by custom field value', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Spotify');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should find people by nickname', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Johnny');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should find people by display name override', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Hatter');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
      expect(results[0].displayNameOverride).toBe('Hatter');
    });

    it('should support prefix matching', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Gar');
      expect(results.some((r) => r.id === '1')).toBe(true);
    });

    it('should support fuzzy matching for typos', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'Johhny');
      expect(results.some((r) => r.id === '2')).toBe(true);
    });

    it('should return empty array for empty query', () => {
      const index = createSearchIndex(testDocuments);
      expect(searchIndex(index, '')).toHaveLength(0);
    });

    it('should return empty array for whitespace-only query', () => {
      const index = createSearchIndex(testDocuments);
      expect(searchIndex(index, '   ')).toHaveLength(0);
    });

    it('should return stored fields in results', () => {
      const index = createSearchIndex(testDocuments);
      const results = searchIndex(index, 'John');
      const result = results[0];
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('surname');
      expect(result).toHaveProperty('nickname');
      expect(result).toHaveProperty('displayNameOverride');
      expect(result).toHaveProperty('photo');
      expect(result).toHaveProperty('score');
    });

    it('should limit results to maxResults', () => {
      const docs = Array.from({ length: 30 }, (_, i) => ({
        ...testDocuments[0],
        id: `doc-${i}`,
        name: `Person ${i}`,
      }));
      const index = createSearchIndex(docs);
      const results = searchIndex(index, 'Person', 5);
      expect(results).toHaveLength(5);
    });

    it('should default to 20 max results', () => {
      const docs = Array.from({ length: 30 }, (_, i) => ({
        ...testDocuments[0],
        id: `doc-${i}`,
        name: `Person ${i}`,
      }));
      const index = createSearchIndex(docs);
      const results = searchIndex(index, 'Person');
      expect(results.length).toBeLessThanOrEqual(20);
    });
  });
});
