import {
  updateProfileSchema, updatePasswordSchema,
  updateThemeSchema, updateDateFormatSchema, updateNameOrderSchema,
  updateNameDisplayFormatSchema, updateGraphDisplaySchema,
  importDataSchema,
} from '../validations';
import { zodBody, jsonBody, jsonResponse, ref400, ref401, refMessage, resp } from './helpers';

export function userPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/user/profile': {
      get: {
        tags: ['User Settings'],
        summary: 'Get current user profile',
        description: 'Returns the authenticated user\'s profile information and preferences.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('User profile', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '401': ref401(),
        },
      },
      put: {
        tags: ['User Settings'],
        summary: 'Update user profile',
        description: 'Updates name, surname, nickname, and/or email. If email is changed, a verification email is sent and the account is marked as unverified.',
        security: [{ session: [] }],
        requestBody: zodBody(updateProfileSchema),
        responses: {
          '200': jsonResponse('Profile updated', {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/UserProfile' },
              emailChanged: { type: 'boolean' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/password': {
      put: {
        tags: ['User Settings'],
        summary: 'Change password',
        description: 'Changes the user\'s password. Requires the current password for verification.',
        security: [{ session: [] }],
        requestBody: zodBody(updatePasswordSchema),
        responses: {
          '200': refMessage(),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/theme': {
      put: {
        tags: ['User Settings'],
        summary: 'Update theme preference',
        security: [{ session: [] }],
        requestBody: zodBody(updateThemeSchema),
        responses: {
          '200': jsonResponse('Theme updated', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/date-format': {
      put: {
        tags: ['User Settings'],
        summary: 'Update date format preference',
        security: [{ session: [] }],
        requestBody: zodBody(updateDateFormatSchema),
        responses: {
          '200': jsonResponse('Date format updated', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/graph-display': {
      put: {
        tags: ['User Settings'],
        summary: 'Update network-graph display preferences',
        description: 'Updates the user\'s network-graph display mode (individuals or bubbles).',
        security: [{ session: [] }],
        requestBody: zodBody(updateGraphDisplaySchema),
        responses: {
          '200': jsonResponse('Graph display settings updated', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/name-order': {
      put: {
        tags: ['User Settings'],
        summary: 'Update name display order preference',
        security: [{ session: [] }],
        requestBody: zodBody(updateNameOrderSchema),
        responses: {
          '200': jsonResponse('Name order updated', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/name-display-format': {
      put: {
        tags: ['User Settings'],
        summary: 'Update name display format preference',
        security: [{ session: [] }],
        requestBody: zodBody(updateNameDisplayFormatSchema),
        responses: {
          '200': jsonResponse('Name display format updated', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/UserProfile' } },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/language': {
      put: {
        tags: ['User Settings'],
        summary: 'Update language preference',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            language: { type: 'string', enum: ['en', 'es-ES', 'ja-JP', 'nb-NO', 'de-DE'] },
          },
          required: ['language'],
        }),
        responses: {
          '200': jsonResponse('Language updated', {
            type: 'object',
            properties: { success: { type: 'boolean' }, language: { type: 'string' } },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/export': {
      get: {
        tags: ['User Settings'],
        summary: 'Export user data',
        description: 'Exports all user data (people, groups, relationships, relationship types) as JSON. Optionally filter by groups.',
        security: [{ session: [] }],
        parameters: [
          { name: 'groupIds', in: 'query', schema: { type: 'string' }, description: 'Comma-separated group IDs to filter export' },
        ],
        responses: {
          '200': jsonResponse('Exported data', {
            type: 'object',
            properties: {
              version: { type: 'string' },
              exportDate: { type: 'string', format: 'date-time' },
              user: { type: 'object' },
              groups: { type: 'array', items: { type: 'object' } },
              people: { type: 'array', items: { type: 'object' } },
              relationshipTypes: { type: 'array', items: { type: 'object' } },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/user/import/validate': {
      post: {
        tags: ['User Settings'],
        summary: 'Validate import data',
        description: 'Validates a data import payload without actually importing. Returns counts and conflict information.',
        security: [{ session: [] }],
        requestBody: jsonBody({ type: 'object', description: 'Export-format JSON data' }),
        responses: {
          '200': jsonResponse('Validation result', {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              newPeopleCount: { type: 'integer' },
              newGroupsCount: { type: 'integer' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/import': {
      post: {
        tags: ['User Settings'],
        summary: 'Import user data',
        description: 'Imports people, groups, relationships, and relationship types from a Nametag export JSON file.',
        security: [{ session: [] }],
        requestBody: zodBody(importDataSchema),
        responses: {
          '200': jsonResponse('Import result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              imported: {
                type: 'object',
                properties: {
                  groups: { type: 'integer' },
                  people: { type: 'integer' },
                  relationshipTypes: { type: 'integer' },
                },
              },
            },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/delete': {
      delete: {
        tags: ['User Settings'],
        summary: 'Delete account',
        description: 'Permanently deletes the user account and all associated data. Requires typing "DELETE" to confirm.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            password: { type: 'string', description: 'Current password (required for credential accounts)' },
            confirmationText: { type: 'string', description: 'Must be exactly "DELETE"' },
          },
          required: ['confirmationText'],
        }),
        responses: {
          '200': refMessage(),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/photo': {
      post: {
        tags: ['Photos'],
        summary: 'Upload or replace user photo',
        description: 'Upload a photo for the logged-in user. The image is cropped to 256x256, converted to JPEG, and EXIF data is stripped.',
        security: [{ session: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  photo: {
                    type: 'string',
                    format: 'binary',
                    description: 'Photo image file',
                  },
                },
                required: ['photo'],
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Photo uploaded', {
            type: 'object',
            properties: {
              photo: { type: 'string', description: 'Saved photo filename' },
            },
            required: ['photo'],
          }),
          '400': resp('Validation error or invalid image'),
          '401': ref401(),
        },
      },
      delete: {
        tags: ['Photos'],
        summary: 'Remove user photo',
        description: 'Deletes the photo associated with the logged-in user.',
        security: [{ session: [] }],
        responses: {
          '200': refMessage(),
          '401': ref401(),
        },
      },
    },
  };
}
