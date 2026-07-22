import {
  createGroupSchema, updateGroupSchema, addGroupMemberSchema,
} from '../validations';
import { zodBody, pathParam, jsonResponse, ref400, ref401, ref404, refMessage, refSuccess, resp } from './helpers';

export function groupsPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/groups': {
      get: {
        tags: ['Groups'],
        summary: 'List all groups',
        description: 'Returns all groups for the authenticated user, with their members.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of groups', {
            type: 'object',
            properties: {
              groups: { type: 'array', items: { $ref: '#/components/schemas/Group' } },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Groups'],
        summary: 'Create a new group',
        description: 'Creates a group with a name, optional description/color, and optional initial members.',
        security: [{ session: [] }],
        requestBody: zodBody(createGroupSchema),
        responses: {
          '201': jsonResponse('Group created', {
            type: 'object',
            properties: { group: { $ref: '#/components/schemas/Group' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Plan limit reached'),
        },
      },
    },
    '/api/groups/{id}': {
      get: {
        tags: ['Groups'],
        summary: 'Get a group by ID',
        description: 'Returns a single group with its member list.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID')],
        responses: {
          '200': jsonResponse('Group details', {
            type: 'object',
            properties: { group: { $ref: '#/components/schemas/Group' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Groups'],
        summary: 'Update a group',
        description: 'Updates the name, description, and/or color of a group.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID')],
        requestBody: zodBody(updateGroupSchema),
        responses: {
          '200': jsonResponse('Group updated', {
            type: 'object',
            properties: { group: { $ref: '#/components/schemas/Group' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Groups'],
        summary: 'Delete a group',
        description: 'Soft-deletes a group. Optionally also soft-deletes all people in the group.',
        security: [{ session: [] }],
        parameters: [
          pathParam('id', 'Group ID'),
          { name: 'deletePeople', in: 'query', schema: { type: 'boolean' }, description: 'Also delete all people in this group' },
        ],
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/groups/{id}/restore': {
      post: {
        tags: ['Groups'],
        summary: 'Restore a deleted group',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID')],
        responses: {
          '200': jsonResponse('Group restored', {
            type: 'object',
            properties: { group: { $ref: '#/components/schemas/Group' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/groups/{id}/permanent': {
      delete: {
        tags: ['Groups'],
        summary: 'Permanently delete a group',
        description: 'Permanently deletes a soft-deleted group and its memberships. This cannot be undone.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID')],
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/groups/{id}/members': {
      post: {
        tags: ['Groups'],
        summary: 'Add a person to a group',
        description: 'Adds an existing person as a member of the specified group.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID')],
        requestBody: zodBody(addGroupMemberSchema),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/groups/{id}/members/{personId}': {
      delete: {
        tags: ['Groups'],
        summary: 'Remove a person from a group',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Group ID'), pathParam('personId', 'Person ID')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // Deleted Items
    '/api/deleted': {
      get: {
        tags: ['Deleted Items'],
        summary: 'List soft-deleted items',
        description: 'Returns items deleted within the retention period (30 days), filtered by type.',
        security: [{ session: [] }],
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: true,
            schema: { type: 'string', enum: ['people', 'groups', 'relationships', 'relationshipTypes', 'importantDates'] },
            description: 'Entity type to list',
          },
        ],
        responses: {
          '200': jsonResponse('Deleted items', {
            type: 'object',
            properties: {
              deleted: { type: 'array', items: { type: 'object' } },
              retentionDays: { type: 'integer' },
              cutoffDate: { type: 'string', format: 'date-time' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
  };
}
