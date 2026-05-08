import {
  customFieldTemplateCreateSchema,
  customFieldTemplateUpdateSchema,
  customFieldTemplateReorderSchema,
} from '../validations';
import {
  zodBody,
  pathParam,
  jsonResponse,
  ref400,
  ref401,
  ref404,
  refSuccess,
  resp,
} from './helpers';

export function customFieldsPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/custom-field-templates': {
      get: {
        tags: ['Custom Fields'],
        summary: 'List custom field templates',
        description: 'Returns active custom field templates for the authenticated user, ordered by display order.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of templates', {
            type: 'object',
            properties: {
              templates: {
                type: 'array',
                items: { $ref: '#/components/schemas/CustomFieldTemplate' },
              },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Custom Fields'],
        summary: 'Create a custom field template',
        description: 'Creates a typed custom field schema. Slug is derived from name and immutable.',
        security: [{ session: [] }],
        requestBody: zodBody(customFieldTemplateCreateSchema),
        responses: {
          '201': jsonResponse('Template created', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Plan limit reached'),
          '409': resp('A template with this slug already exists'),
        },
      },
    },
    '/api/custom-field-templates/{id}': {
      get: {
        tags: ['Custom Fields'],
        summary: 'Get a custom field template',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Template ID')],
        responses: {
          '200': jsonResponse('Template', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Custom Fields'],
        summary: 'Update a custom field template',
        description: 'Updates name and/or options. Type and slug are immutable.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Template ID')],
        requestBody: zodBody(customFieldTemplateUpdateSchema),
        responses: {
          '200': jsonResponse('Template updated', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Custom Fields'],
        summary: 'Soft-delete a custom field template',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'Template ID')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/custom-field-templates/reorder': {
      put: {
        tags: ['Custom Fields'],
        summary: 'Reorder templates',
        description: "Reorders the user's custom field templates. The provided id list determines the new display order.",
        security: [{ session: [] }],
        requestBody: zodBody(customFieldTemplateReorderSchema),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
  };
}
