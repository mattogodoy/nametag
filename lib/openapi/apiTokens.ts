import { createApiTokenSchema } from '../validations';
import {
  zodBody,
  jsonResponse,
  ref400,
  ref401,
  ref404,
  refSuccess,
  pathParam,
} from './helpers';

const apiTokenObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    prefix: {
      type: 'string',
      description: 'Leading characters of the token, shown for recognition',
    },
    scope: { type: 'string', enum: ['READ', 'READ_WRITE'] },
    lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
    expiresAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

// The create response additionally includes the plaintext `token`, returned once.
const createdApiTokenObject = {
  type: 'object',
  properties: {
    ...apiTokenObject.properties,
    token: {
      type: 'string',
      description:
        'The plaintext token. Returned ONLY on creation: store it now, it cannot be retrieved again.',
    },
  },
};

export function apiTokenPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/user/api-tokens': {
      get: {
        tags: ['API Tokens'],
        summary: 'List API tokens',
        description:
          "Lists the current user's API tokens. Never returns the secret value. Session (cookie) auth only.",
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('User API tokens', {
            type: 'object',
            properties: {
              tokens: { type: 'array', items: apiTokenObject },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['API Tokens'],
        summary: 'Create an API token',
        description:
          'Creates a new API token. The plaintext token is returned ONCE in the response and cannot be retrieved again. Session (cookie) auth only.',
        security: [{ session: [] }],
        requestBody: zodBody(createApiTokenSchema),
        responses: {
          '201': jsonResponse('Created token (plaintext shown once)', {
            type: 'object',
            properties: { apiToken: createdApiTokenObject },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/user/api-tokens/{id}': {
      delete: {
        tags: ['API Tokens'],
        summary: 'Revoke an API token',
        description:
          'Permanently revokes (deletes) an API token. Session (cookie) auth only.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'API token ID')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
  };
}
