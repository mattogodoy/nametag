import { describe, it, expect } from 'vitest';
import {
  relationshipsWithUserToGraphEdges,
  relationshipToGraphEdge,
  inverseRelationshipToGraphEdge,
  personToGraphNode,
} from '@/lib/graph-utils';

describe('graph-utils', () => {
  describe('relationshipsWithUserToGraphEdges', () => {
    it('should create both edges when inverse is provided', () => {
      const person = {
        id: 'person-1',
        relationshipToUser: {
          label: 'Child',
          color: '#F59E0B',
          inverse: {
            label: 'Parent',
            color: '#F59E0B',
          },
        },
      };

      const edges = relationshipsWithUserToGraphEdges(person, 'user-1');

      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({
        source: 'person-1',
        target: 'user-1',
        type: 'Child',
        color: '#F59E0B',
      });
      expect(edges[1]).toEqual({
        source: 'user-1',
        target: 'person-1',
        type: 'Parent',
        color: '#F59E0B',
      });
    });

    it('should fall back to type itself when inverse is null (symmetric types)', () => {
      const person = {
        id: 'person-1',
        relationshipToUser: {
          label: 'Relative',
          color: '#6366F1',
          inverse: null,
        },
      };

      const edges = relationshipsWithUserToGraphEdges(person, 'user-1');

      expect(edges).toHaveLength(2);
      expect(edges[0]).toEqual({
        source: 'person-1',
        target: 'user-1',
        type: 'Relative',
        color: '#6366F1',
      });
      expect(edges[1]).toEqual({
        source: 'user-1',
        target: 'person-1',
        type: 'Relative',
        color: '#6366F1',
      });
    });

    it('should return no edges when relationshipToUser is null', () => {
      const person = {
        id: 'person-1',
        relationshipToUser: null,
      };

      const edges = relationshipsWithUserToGraphEdges(person, 'user-1');

      expect(edges).toHaveLength(0);
    });
  });

  describe('personToGraphNode', () => {
    it('should include photo in the graph node', () => {
      const person = {
        id: 'person-1',
        name: 'John',
        surname: 'Doe',
        nickname: null,
        photo: 'photos/person-1.webp',
        groups: [
          { group: { id: 'g-family', name: 'Family', color: '#FF0000' } },
        ],
      };

      const node = personToGraphNode(person);

      expect(node.id).toBe('person-1');
      expect(node.photo).toBe('photos/person-1.webp');
      expect(node.colors).toEqual(['#FF0000']);
      expect(node.isCenter).toBe(false);
    });

    it('should handle null photo', () => {
      const person = {
        id: 'person-2',
        name: 'Jane',
        surname: null,
        nickname: null,
        photo: null,
        groups: [],
      };

      const node = personToGraphNode(person, true);

      expect(node.id).toBe('person-2');
      expect(node.photo).toBeNull();
      expect(node.isCenter).toBe(true);
    });
  });

  describe('relationshipToGraphEdge', () => {
    it('should create a forward edge', () => {
      const relationship = {
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipType: {
          label: 'Parent',
          color: '#F59E0B',
        },
      };

      const edge = relationshipToGraphEdge(relationship);

      expect(edge).toEqual({
        source: 'person-1',
        target: 'person-2',
        type: 'Parent',
        color: '#F59E0B',
      });
    });

    it('should return undefined when relationshipType is null', () => {
      const relationship = {
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipType: null,
      };

      const edge = relationshipToGraphEdge(relationship);

      expect(edge).toBeUndefined();
    });
  });

  describe('inverseRelationshipToGraphEdge', () => {
    it('should create an inverse edge using the inverse type', () => {
      const relationship = {
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipType: {
          label: 'Parent',
          color: '#F59E0B',
          inverse: {
            label: 'Child',
            color: '#F59E0B',
          },
        },
      };

      const edge = inverseRelationshipToGraphEdge(relationship);

      expect(edge).toEqual({
        source: 'person-2',
        target: 'person-1',
        type: 'Child',
        color: '#F59E0B',
      });
    });

    it('should fall back to type itself when inverse is null (symmetric types)', () => {
      const relationship = {
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipType: {
          label: 'Relative',
          color: '#6366F1',
          inverse: null,
        },
      };

      const edge = inverseRelationshipToGraphEdge(relationship);

      expect(edge).toEqual({
        source: 'person-2',
        target: 'person-1',
        type: 'Relative',
        color: '#6366F1',
      });
    });

    it('should return undefined when relationshipType is null', () => {
      const relationship = {
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipType: null,
      };

      const edge = inverseRelationshipToGraphEdge(relationship);

      expect(edge).toBeUndefined();
    });
  });
});
