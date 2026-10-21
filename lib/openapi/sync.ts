import { jsonResponse, ref400, ref401, resp, sessionOrToken } from './helpers';

const record = { type: 'object', additionalProperties: true };

const changeKeys = [
  'people',
  'groups',
  'relationships',
  'importantDates',
  'relationshipTypes',
  'journalEntries',
  'customFieldTemplates',
];

export function syncPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/sync': {
      get: {
        tags: ['Sync'],
        summary: 'Changes since a cursor',
        description:
          'Returns every change and deletion since `cursor`, oldest first, for keeping a local copy in sync. ' +
          'Start with cursor 0, then pass the returned cursor until hasMore is false. The cursor is opaque: send it back unchanged (a full sync can return cursors like 812:950). ' +
          'Soft-deleted records are included with deletedAt set. Every record carries syncVersion as a string. ' +
          'People include contact child arrays, groupIds and customFieldValues; journal entries include personIds. ' +
          'Decimal fields such as latitude and longitude are numeric strings. ' +
          'On 410 sync_cursor_expired, discard the cache and start again from 0. ' +
          'A cursor ahead of the server returns 400 invalid_query and also calls for a full resync.',
        security: sessionOrToken(),
        parameters: [
          { name: 'cursor', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d+(:\\d+)?$' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000, default: 500 } },
        ],
        responses: {
          '200': jsonResponse('A page of changes', {
            type: 'object',
            required: ['cursor', 'hasMore', 'changes', 'deleted'],
            properties: {
              cursor: { type: 'string', example: '1234' },
              hasMore: { type: 'boolean' },
              changes: {
                type: 'object',
                properties: Object.fromEntries(
                  changeKeys.map((k) => [k, { type: 'array', items: record }])
                ),
              },
              deleted: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['type', 'id'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['person', 'group', 'relationship', 'importantDate', 'relationshipType', 'journalEntry', 'customFieldTemplate'],
                    },
                    id: { type: 'string' },
                  },
                },
              },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '410': resp('Cursor expired (sync_cursor_expired)'),
        },
      },
    },
  };
}
