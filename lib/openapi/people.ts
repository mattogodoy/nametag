import {
  createPersonSchema, updatePersonSchema, deletePersonSchema,
  createImportantDateSchema, updateImportantDateSchema,
  mergePersonSchema,
} from '../validations';
import { zodBody, jsonBody, pathParam, jsonResponse, ref400, ref401, ref404, refMessage, refGraph, resp } from './helpers';

export function peoplePaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/people': {
      get: {
        tags: ['People'],
        summary: 'List all people',
        description: 'Returns all people belonging to the authenticated user, sorted alphabetically by name. Includes relationship-to-user info and group memberships.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of people', {
            type: 'object',
            properties: {
              people: { type: 'array', items: { $ref: '#/components/schemas/Person' } },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['People'],
        summary: 'Create a new person',
        description: 'Adds a new person to your network. Can include group memberships, important dates, and a relationship type to you (or connected through another person).',
        security: [{ session: [] }],
        requestBody: zodBody(createPersonSchema),
        responses: {
          '201': jsonResponse('Person created', {
            type: 'object',
            properties: { person: { $ref: '#/components/schemas/Person' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Plan limit reached'),
        },
      },
    },
    '/api/people/{id}': {
      get: {
        tags: ['People'],
        summary: 'Get a person by ID',
        description: 'Returns full details for a single person, including their relationships, groups, and important dates.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': jsonResponse('Person details', {
            type: 'object',
            properties: { person: { $ref: '#/components/schemas/Person' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['People'],
        summary: 'Update a person',
        description: 'Updates any fields of an existing person. Group memberships and important dates are replaced in full when provided.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        requestBody: zodBody(updatePersonSchema),
        responses: {
          '200': jsonResponse('Person updated', {
            type: 'object',
            properties: { person: { $ref: '#/components/schemas/Person' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['People'],
        summary: 'Delete a person',
        description: 'Soft-deletes a person. Optionally also deletes orphaned people who were only connected through this person.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        requestBody: zodBody(deletePersonSchema),
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/{id}/restore': {
      post: {
        tags: ['People'],
        summary: 'Restore a deleted person',
        description: 'Restores a soft-deleted person back to active status.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': jsonResponse('Person restored', {
            type: 'object',
            properties: { person: { $ref: '#/components/schemas/Person' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/search': {
      get: {
        tags: ['People'],
        summary: 'Search people by name',
        description: 'Searches across name, surname, middle name, second last name, and nickname. Case-insensitive. Returns up to 20 results.',
        security: [{ session: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query (min 1 character)' },
        ],
        responses: {
          '200': jsonResponse('Search results', {
            type: 'object',
            properties: {
              people: { type: 'array', items: { $ref: '#/components/schemas/PersonSummary' } },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/people/search-index': {
      get: {
        tags: ['People'],
        summary: 'Get search index data',
        description:
          'Returns all searchable data for the authenticated user\'s contacts in a flat, ' +
          'denormalized format optimized for client-side indexing. Multi-value fields ' +
          '(phones, emails, addresses, etc.) are joined into single strings.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Search index data', {
            type: 'object',
            properties: {
              people: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    surname: { type: 'string', nullable: true },
                    middleName: { type: 'string', nullable: true },
                    secondLastName: { type: 'string', nullable: true },
                    nickname: { type: 'string', nullable: true },
                    organization: { type: 'string', nullable: true },
                    jobTitle: { type: 'string', nullable: true },
                    notes: { type: 'string', nullable: true },
                    phones: { type: 'string', description: 'All phone numbers, space-joined' },
                    emails: { type: 'string', description: 'All email addresses, space-joined' },
                    addresses: { type: 'string', description: 'All address components, space-joined' },
                    urls: { type: 'string', description: 'All URLs, space-joined' },
                    imHandles: { type: 'string', description: 'All IM handles, space-joined' },
                    groups: { type: 'string', description: 'All group names, space-joined' },
                    customFields: { type: 'string', description: 'All custom field key-value pairs, space-joined' },
                    photo: { type: 'string', nullable: true },
                  },
                  required: ['id', 'name', 'phones', 'emails', 'addresses', 'urls', 'imHandles', 'groups', 'customFields'],
                },
              },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/people/{id}/orphans': {
      get: {
        tags: ['People'],
        summary: 'Find orphaned connections',
        description: 'Returns people who are only connected to the network through this person. Useful before deletion to warn about people who would become disconnected.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': jsonResponse('Orphan list', {
            type: 'object',
            properties: {
              orphans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fullName: { type: 'string' },
                  },
                },
              },
            },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/bulk': {
      post: {
        tags: ['People'],
        summary: 'Bulk actions on people',
        description: 'Perform bulk operations on multiple people. Supports delete (soft-delete with optional orphan and CardDAV cleanup), add to groups, and set relationship type. Specify either personIds or selectAll: true.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          required: ['action'],
          discriminator: { propertyName: 'action' },
          oneOf: [
            {
              type: 'object',
              required: ['action'],
              properties: {
                action: { type: 'string', enum: ['delete'] },
                personIds: { type: 'array', items: { type: 'string' } },
                selectAll: { type: 'boolean' },
                deleteOrphans: { type: 'boolean' },
                orphanIds: { type: 'array', items: { type: 'string' } },
                deleteFromCardDav: { type: 'boolean' },
              },
            },
            {
              type: 'object',
              required: ['action', 'groupIds'],
              properties: {
                action: { type: 'string', enum: ['addToGroups'] },
                personIds: { type: 'array', items: { type: 'string' } },
                selectAll: { type: 'boolean' },
                groupIds: { type: 'array', items: { type: 'string' } },
              },
            },
            {
              type: 'object',
              required: ['action', 'relationshipTypeId'],
              properties: {
                action: { type: 'string', enum: ['setRelationship'] },
                personIds: { type: 'array', items: { type: 'string' } },
                selectAll: { type: 'boolean' },
                relationshipTypeId: { type: 'string' },
              },
            },
          ],
        }),
        responses: {
          '200': jsonResponse('Bulk action result', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              affectedCount: { type: 'integer' },
            },
          }),
          '400': { description: 'Validation error' },
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/bulk/orphans': {
      post: {
        tags: ['People'],
        summary: 'Find orphans for bulk deletion',
        description: 'Computes the aggregate list of people who would become disconnected from the network if the specified people were deleted. Used to warn before bulk delete.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          properties: {
            personIds: { type: 'array', items: { type: 'string' } },
            selectAll: { type: 'boolean' },
          },
        }),
        responses: {
          '200': jsonResponse('Orphan check result', {
            type: 'object',
            properties: {
              orphans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fullName: { type: 'string' },
                  },
                },
              },
              hasCardDavSync: { type: 'boolean' },
            },
          }),
          '400': { description: 'Validation error' },
          '401': ref401(),
        },
      },
    },
    '/api/people/{id}/graph': {
      get: {
        tags: ['People'],
        summary: 'Get relationship graph for a person',
        description: 'Returns a D3-compatible graph (nodes and edges) centered on the specified person, showing their direct connections.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': refGraph(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // Duplicates & Merge
    '/api/people/duplicates': {
      get: {
        tags: ['People'],
        summary: 'Find all duplicate contact groups',
        description: 'Scans all contacts and returns groups of potential duplicates based on name, email, phone, and birthday similarity. Dismissed pairs are excluded.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Duplicate groups', {
            type: 'object',
            properties: {
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    people: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          surname: { type: 'string', nullable: true },
                        },
                      },
                    },
                    similarity: { type: 'number', description: 'Score between 0 and 1' },
                  },
                },
              },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/people/{id}/duplicates': {
      get: {
        tags: ['People'],
        summary: 'Find duplicate candidates for a person',
        description: 'Returns contacts similar to the specified person, sorted by similarity descending. Dismissed pairs are excluded.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': jsonResponse('Duplicate candidates', {
            type: 'object',
            properties: {
              duplicates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    personId: { type: 'string' },
                    name: { type: 'string' },
                    surname: { type: 'string', nullable: true },
                    similarity: { type: 'number', description: 'Score between 0 and 1' },
                  },
                },
              },
            },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/duplicates/dismiss': {
      post: {
        tags: ['People'],
        summary: 'Dismiss a duplicate pair',
        description: 'Marks two contacts as not duplicates so they no longer appear in duplicate detection results.',
        security: [{ session: [] }],
        requestBody: jsonBody({
          type: 'object',
          required: ['personAId', 'personBId'],
          properties: {
            personAId: { type: 'string', description: 'ID of the first person' },
            personBId: { type: 'string', description: 'ID of the second person' },
          },
        }),
        responses: {
          '200': jsonResponse('Pair dismissed', {
            type: 'object',
            properties: {
              dismissed: { type: 'boolean' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/merge': {
      post: {
        tags: ['People'],
        summary: 'Merge two contacts',
        description: 'Merges the secondary contact into the primary contact. Relationships, groups, multi-value fields, and important dates are transferred. The secondary contact is soft-deleted after merge.',
        security: [{ session: [] }],
        requestBody: zodBody(mergePersonSchema),
        responses: {
          '200': jsonResponse('Merge result', {
            type: 'object',
            properties: {
              person: { $ref: '#/components/schemas/Person' },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // Important Dates
    '/api/people/{id}/important-dates': {
      get: {
        tags: ['Important Dates'],
        summary: 'List important dates for a person',
        description: 'Returns all important dates associated with a person, sorted by date ascending.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': jsonResponse('Important dates list', {
            type: 'object',
            properties: {
              importantDates: { type: 'array', items: { $ref: '#/components/schemas/ImportantDate' } },
            },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      post: {
        tags: ['Important Dates'],
        summary: 'Create an important date',
        description: 'Adds a new important date to a person with optional reminder configuration.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        requestBody: zodBody(createImportantDateSchema),
        responses: {
          '201': jsonResponse('Important date created', {
            type: 'object',
            properties: { importantDate: { $ref: '#/components/schemas/ImportantDate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Reminder limit reached'),
          '404': ref404(),
        },
      },
    },
    '/api/people/{id}/important-dates/{dateId}': {
      put: {
        tags: ['Important Dates'],
        summary: 'Update an important date',
        description: 'Updates the title, date, and/or reminder settings for an important date.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID'), pathParam('dateId', 'Important date ID')],
        requestBody: zodBody(updateImportantDateSchema),
        responses: {
          '200': jsonResponse('Important date updated', {
            type: 'object',
            properties: { importantDate: { $ref: '#/components/schemas/ImportantDate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Important Dates'],
        summary: 'Delete an important date',
        description: 'Soft-deletes an important date. Can be restored within the retention period.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID'), pathParam('dateId', 'Important date ID')],
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/people/{id}/important-dates/{dateId}/restore': {
      post: {
        tags: ['Important Dates'],
        summary: 'Restore a deleted important date',
        description: 'Restores a soft-deleted important date.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID'), pathParam('dateId', 'Important date ID')],
        responses: {
          '200': jsonResponse('Important date restored', {
            type: 'object',
            properties: { importantDate: { $ref: '#/components/schemas/ImportantDate' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },

    // Photos (person-specific)
    '/api/people/{id}/photo': {
      post: {
        tags: ['Photos'],
        summary: 'Upload or replace a person photo',
        description: 'Upload a photo for a person. The image is cropped to 256x256, converted to JPEG, and EXIF data is stripped.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
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
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Photos'],
        summary: 'Remove a person photo',
        description: 'Deletes the photo associated with a person.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Person ID')],
        responses: {
          '200': refMessage(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
  };
}
