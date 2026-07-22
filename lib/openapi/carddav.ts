import { jsonBody, pathParam, jsonResponse, ref400, ref401, ref404, refSuccess, resp } from './helpers';

export function carddavPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/carddav/connection': {
      post: {
        tags: ['CardDAV'],
        summary: 'Create CardDAV connection',
        description: 'Creates a new CardDAV server connection for the authenticated user. Only one connection per user is allowed.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            serverUrl: { type: 'string', format: 'uri' },
            username: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
            provider: { type: ['string', 'null'], description: 'Provider hint: google, icloud, outlook, nextcloud, custom' },
            syncEnabled: { type: 'boolean' },
            autoExportNew: { type: 'boolean' },
            autoSyncInterval: { type: 'integer', minimum: 60, maximum: 86400, description: 'Sync interval in seconds' },
            importMode: { type: 'string', enum: ['manual', 'notify', 'auto'] },
            cardDavNameFormat: { type: 'string', enum: ['FULL', 'FIRST_LAST', 'NICKNAME_PREFERRED', 'SHORT'], description: 'Name format used for the vCard FN field when syncing' },
          },
          required: ['serverUrl', 'username', 'password'],
        }),
        responses: {
          '201': jsonResponse('Connection created', {
            type: 'object',
            properties: { connection: { $ref: '#/components/schemas/CardDavConnection' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '409': resp('Connection already exists'),
        },
      },
      put: {
        tags: ['CardDAV'],
        summary: 'Update CardDAV connection',
        description: 'Updates the existing CardDAV connection settings. Password is optional (only updated if provided).',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            serverUrl: { type: 'string', format: 'uri' },
            username: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
            provider: { type: ['string', 'null'] },
            syncEnabled: { type: 'boolean' },
            autoExportNew: { type: 'boolean' },
            autoSyncInterval: { type: 'integer', minimum: 60, maximum: 86400 },
            importMode: { type: 'string', enum: ['manual', 'notify', 'auto'] },
            cardDavNameFormat: { type: 'string', enum: ['FULL', 'FIRST_LAST', 'NICKNAME_PREFERRED', 'SHORT'], description: 'Name format used for the vCard FN field when syncing' },
          },
          required: ['serverUrl', 'username'],
        }),
        responses: {
          '200': jsonResponse('Connection updated', {
            type: 'object',
            properties: { connection: { $ref: '#/components/schemas/CardDavConnection' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['CardDAV'],
        summary: 'Delete CardDAV connection',
        description: 'Disconnects and deletes the CardDAV connection, removing all sync mappings and pending imports.',
        security: [{ session: [] }],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/carddav/connection/test': {
      post: {
        tags: ['CardDAV'],
        summary: 'Test CardDAV credentials',
        description: 'Tests connectivity to a CardDAV server with the given credentials without saving them.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            serverUrl: { type: 'string', format: 'uri' },
            username: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
          },
          required: ['serverUrl', 'username', 'password'],
        }),
        responses: {
          '200': jsonResponse('Connection successful', {
            type: 'object',
            properties: {
              success: { type: 'boolean', enum: [true] },
              message: { type: 'string' },
            },
          }),
          '400': ref400(),
          '401': resp('Authentication failed'),
          '404': resp('Server not found'),
          '408': resp('Connection timeout'),
        },
      },
    },
    '/api/carddav/sync': {
      post: {
        tags: ['CardDAV'],
        summary: 'Manual bidirectional sync',
        description:
          'Triggers a full bidirectional sync with the CardDAV server. Returns a Server-Sent Events stream with progress updates. ' +
          'Event types: `progress` (sync progress updates), `complete` (final results with counts), `error` (error message). ' +
          'The `complete` event data includes: imported, exported, updatedLocally, updatedRemotely, conflicts, errors, errorMessages, pendingImports.',
        security: [{ session: [] }],
        responses: {
          '200': {
            description: 'SSE stream of sync progress',
            content: {
              'text/event-stream': {
                schema: { type: 'string', description: 'Server-Sent Events stream' },
              },
            },
          },
          '401': ref401(),
        },
      },
    },
    '/api/carddav/import': {
      post: {
        tags: ['CardDAV'],
        summary: 'Import selected contacts',
        description: 'Imports previously discovered pending contacts into Nametag. Supports assigning groups globally or per-contact.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            importIds: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'IDs of pending imports to import' },
            globalGroupIds: { type: 'array', items: { type: 'string' }, description: 'Group IDs to assign to all imported contacts' },
            perContactGroups: {
              type: 'object',
              additionalProperties: { type: 'array', items: { type: 'string' } },
              description: 'Map of import ID to group IDs for per-contact assignment',
            },
            updateExistingIds: { type: 'array', items: { type: 'string' }, description: 'IDs of pending imports whose existing person should be updated instead of skipped' },
          },
          required: ['importIds'],
        }),
        responses: {
          '200': jsonResponse('Import result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              imported: { type: 'integer' },
              updated: { type: 'integer' },
              skipped: { type: 'integer' },
              errors: { type: 'integer' },
              errorMessages: { type: 'array', items: { type: 'string' } },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': resp('No pending imports found'),
        },
      },
    },
    '/api/carddav/export-bulk': {
      post: {
        tags: ['CardDAV'],
        summary: 'Bulk export contacts',
        description: 'Exports selected Nametag contacts to the connected CardDAV server. Processes in batches of 50.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            personIds: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'IDs of people to export' },
          },
          required: ['personIds'],
        }),
        responses: {
          '200': jsonResponse('Export result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              exported: { type: 'integer' },
              skipped: { type: 'integer' },
              errors: { type: 'integer' },
              errorMessages: { type: 'array', items: { type: 'string' } },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/carddav/conflicts/{id}/resolve': {
      post: {
        tags: ['CardDAV'],
        summary: 'Resolve a sync conflict',
        description: 'Resolves a bidirectional sync conflict by keeping the local version, remote version, or a merged result.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Conflict ID')],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            resolution: { type: 'string', enum: ['keep_local', 'keep_remote', 'merged'] },
          },
          required: ['resolution'],
        }),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Forbidden'),
          '404': ref404(),
        },
      },
    },
    '/api/carddav/discover': {
      post: {
        tags: ['CardDAV'],
        summary: 'Discover new contacts',
        description: 'Scans the CardDAV server for contacts not yet imported and creates pending import records.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Discovery result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              discovered: { type: 'integer' },
              errors: { type: 'integer' },
              errorMessages: { type: 'array', items: { type: 'string' } },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/carddav/pending-count': {
      get: {
        tags: ['CardDAV'],
        summary: 'Get pending import count',
        description: 'Returns the number of contacts discovered on the CardDAV server but not yet imported.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Pending count', {
            type: 'object',
            properties: {
              count: { type: 'integer' },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/carddav/backup': {
      post: {
        tags: ['CardDAV'],
        summary: 'Download vCard backup',
        description: 'Downloads all contacts from the connected CardDAV server as a single .vcf file.',
        security: [{ session: [] }],
        responses: {
          '200': {
            description: 'vCard file download',
            headers: {
              'Content-Disposition': { schema: { type: 'string', example: 'attachment; filename="nametag-backup.vcf"' } },
              'X-Contact-Count': { schema: { type: 'string', description: 'Number of contacts in the backup' } },
            },
            content: {
              'text/vcard': { schema: { type: 'string', description: 'Concatenated vCard data' } },
            },
          },
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // vCard
    '/api/vcard/import': {
      post: {
        tags: ['vCard'],
        summary: 'Import vCard file',
        description: 'Parses and directly imports contacts from raw vCard data into Nametag. Maximum file size: 2 MB.',
        security: [{ session: [] }],
        requestBody: {
          required: true,
          content: {
            'text/plain': { schema: { type: 'string', description: 'Raw vCard file content' } },
            'text/vcard': { schema: { type: 'string', description: 'Raw vCard file content' } },
          },
        },
        responses: {
          '200': jsonResponse('Import result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              imported: { type: 'integer' },
              skipped: { type: 'integer' },
              errors: { type: 'integer' },
              errorMessages: { type: 'array', items: { type: 'string' } },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '413': resp('File too large (max 2 MB)'),
        },
      },
    },
    '/api/vcard/upload': {
      post: {
        tags: ['vCard'],
        summary: 'Upload vCard for preview',
        description: 'Parses vCard data and creates pending import records for review before importing. Maximum file size: 2 MB.',
        security: [{ session: [] }],
        requestBody: {
          required: true,
          content: {
            'text/plain': { schema: { type: 'string', description: 'Raw vCard file content' } },
            'text/vcard': { schema: { type: 'string', description: 'Raw vCard file content' } },
          },
        },
        responses: {
          '200': jsonResponse('Upload result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              count: { type: 'integer', description: 'Number of pending imports created' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '413': resp('File too large (max 2 MB)'),
        },
      },
    },

    // Cron
    '/api/cron/carddav-sync': {
      get: {
        tags: ['Cron'],
        summary: 'Background CardDAV sync',
        description: 'Syncs all users with CardDAV connections that have sync enabled and are due for a sync. Processes users with a 200 ms delay between each.',
        security: [{ cronBearer: [] }],
        responses: {
          '200': jsonResponse('Sync results', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              total: { type: 'integer', description: 'Total connections processed' },
              synced: { type: 'integer' },
              skipped: { type: 'integer' },
              errors: { type: 'integer' },
              errorMessages: { type: 'array', items: { type: 'string' } },
            },
          }),
          '401': ref401(),
        },
      },
    },
  };
}
