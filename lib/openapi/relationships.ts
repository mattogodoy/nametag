import {
  createRelationshipSchema, updateRelationshipSchema,
  createRelationshipTypeSchema, updateRelationshipTypeSchema,
} from '../validations';
import { zodBody, pathParam, jsonResponse, ref400, ref401, ref404, refMessage, refSuccess, resp } from './helpers';

export function relationshipsPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/relationships': {
      get: {
        tags: ['Relationships'],
        summary: 'List all relationships',
        description: 'Returns all relationships between people in the authenticated user\'s network, including person and type details.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of relationships', {
            type: 'object',
            properties: {
              relationships: { type: 'array', items: { $ref: '#/components/schemas/Relationship' } },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Relationships'],
        summary: 'Create a relationship',
        description: 'Creates a bidirectional relationship between two people. Automatically creates the inverse relationship.',
        security: [{ session: [] }],
        requestBody: zodBody(createRelationshipSchema),
        responses: {
          '201': jsonResponse('Relationship created', {
            type: 'object',
            properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/relationships/{id}': {
      get: {
        tags: ['Relationships'],
        summary: 'Get a relationship by ID',
        description: 'Returns a single relationship with person and type details.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship ID')],
        responses: {
          '200': jsonResponse('Relationship details', {
            type: 'object',
            properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Relationships'],
        summary: 'Update a relationship',
        description: 'Changes the type and/or notes of an existing relationship. Also updates the inverse relationship.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship ID')],
        requestBody: zodBody(updateRelationshipSchema),
        responses: {
          '200': jsonResponse('Relationship updated', {
            type: 'object',
            properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Relationships'],
        summary: 'Delete a relationship',
        description: 'Soft-deletes a relationship and its inverse.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship ID')],
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/relationships/{id}/restore': {
      post: {
        tags: ['Relationships'],
        summary: 'Restore a deleted relationship',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship ID')],
        responses: {
          '200': jsonResponse('Relationship restored', {
            type: 'object',
            properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    '/api/relationships/{id}/permanent': {
      delete: {
        tags: ['Relationships'],
        summary: 'Permanently delete a relationship',
        description: 'Permanently deletes a soft-deleted relationship and its inverse. This cannot be undone.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship ID')],
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // Relationship Types
    '/api/relationship-types': {
      get: {
        tags: ['Relationship Types'],
        summary: 'List all relationship types',
        description: 'Returns all custom relationship types for the user, including inverse type info.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of relationship types', {
            type: 'object',
            properties: {
              relationshipTypes: { type: 'array', items: { $ref: '#/components/schemas/RelationshipType' } },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Relationship Types'],
        summary: 'Create a relationship type',
        description: 'Creates a new relationship type. Can be symmetric (e.g. Friend <-> Friend) or asymmetric with an inverse (e.g. Parent -> Child). If inverseLabel is provided, the inverse type is auto-created.',
        security: [{ session: [] }],
        requestBody: zodBody(createRelationshipTypeSchema),
        responses: {
          '201': jsonResponse('Relationship type created', {
            type: 'object',
            properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/relationship-types/{id}': {
      get: {
        tags: ['Relationship Types'],
        summary: 'Get a relationship type by ID',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship type ID')],
        responses: {
          '200': jsonResponse('Relationship type details', {
            type: 'object',
            properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Relationship Types'],
        summary: 'Update a relationship type',
        description: 'Updates label, color, inverse, or symmetric status of a relationship type.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship type ID')],
        requestBody: zodBody(updateRelationshipTypeSchema),
        responses: {
          '200': jsonResponse('Relationship type updated', {
            type: 'object',
            properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Relationship Types'],
        summary: 'Delete a relationship type',
        description: 'Soft-deletes a relationship type. Fails if the type is currently in use by any relationships.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship type ID')],
        responses: {
          '200': refSuccess(),
          '400': resp('Type is in use'),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/relationship-types/{id}/restore': {
      post: {
        tags: ['Relationship Types'],
        summary: 'Restore a deleted relationship type',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship type ID')],
        responses: {
          '200': jsonResponse('Relationship type restored', {
            type: 'object',
            properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/relationship-types/{id}/permanent': {
      delete: {
        tags: ['Relationship Types'],
        summary: 'Permanently delete a relationship type',
        description: 'Permanently deletes a soft-deleted relationship type and clears any remaining references to it. This cannot be undone.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Relationship type ID')],
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
  };
}
