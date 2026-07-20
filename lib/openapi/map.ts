import { jsonResponse, ref401 } from './helpers';

export function mapPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/map/markers': {
      get: {
        tags: ['Map'],
        summary: 'Get map markers',
        description:
          'Returns all plottable points for the current user: successfully geocoded addresses and vCard GEO locations, plus the groups they belong to and counts of addresses still pending or failed geocoding.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Map markers', {
            type: 'object',
            properties: {
              markers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'addr_<addressId> or loc_<locationId>' },
                    source: { type: 'string', enum: ['address', 'location'] },
                    personId: { type: 'string' },
                    personName: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    label: { type: 'string' },
                    city: { type: ['string', 'null'] },
                    region: { type: ['string', 'null'], description: 'State/Province' },
                    country: { type: ['string', 'null'] },
                    groupIds: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: { id: { type: 'string' }, name: { type: 'string' } },
                },
              },
              pendingCount: { type: 'integer' },
              failedCount: { type: 'integer' },
              geocodingEnabled: { type: 'boolean' },
            },
          }),
          '401': ref401(),
        },
      },
    },
  };
}
