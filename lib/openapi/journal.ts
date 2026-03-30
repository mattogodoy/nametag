import {
  createJournalEntrySchema, updateJournalEntrySchema,
} from '../validations';
import { zodBody, pathParam, jsonResponse, ref400, ref401, ref404, refMessage } from './helpers';

export function journalPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/journal': {
      get: {
        tags: ['Journal'],
        summary: 'List journal entries',
        description: 'Returns journal entries for the authenticated user, ordered by date descending. Supports filtering by person and text search.',
        security: [{ session: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
          { name: 'person', in: 'query', schema: { type: 'string' }, description: 'Filter by person ID' },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search text in title and body' },
        ],
        responses: {
          '200': jsonResponse('List of journal entries', {
            type: 'object',
            properties: {
              entries: { type: 'array', items: { $ref: '#/components/schemas/JournalEntry' } },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  totalCount: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Journal'],
        summary: 'Create a journal entry',
        description: 'Creates a new journal entry with optional people tags. Can optionally update lastContact for tagged people.',
        security: [{ session: [] }],
        requestBody: zodBody(createJournalEntrySchema),
        responses: {
          '201': jsonResponse('Journal entry created', {
            type: 'object',
            properties: { entry: { $ref: '#/components/schemas/JournalEntry' } },
          }),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/journal/{id}': {
      get: {
        tags: ['Journal'],
        summary: 'Get a journal entry by ID',
        description: 'Returns a single journal entry with tagged people.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Journal entry ID')],
        responses: {
          '200': jsonResponse('Journal entry details', {
            type: 'object',
            properties: { entry: { $ref: '#/components/schemas/JournalEntry' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Journal'],
        summary: 'Update a journal entry',
        description: 'Updates title, date, body, and people tags. Can optionally update lastContact.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Journal entry ID')],
        requestBody: zodBody(updateJournalEntrySchema),
        responses: {
          '200': jsonResponse('Journal entry updated', {
            type: 'object',
            properties: { entry: { $ref: '#/components/schemas/JournalEntry' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Journal'],
        summary: 'Delete a journal entry',
        description: 'Soft-deletes a journal entry.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Journal entry ID')],
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
  };
}
