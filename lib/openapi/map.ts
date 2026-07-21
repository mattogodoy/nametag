import { retryGeocodeSchema } from '../validations';
import { jsonResponse, ref400, ref401, ref404, zodBody } from './helpers';

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
                    addressText: {
                      type: ['string', 'null'],
                      description: 'Full address as a single line for popups; null for GEO locations',
                    },
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
              unlocatedPeople: {
                type: 'array',
                description: 'Contacts with addresses the geocoder could not locate, sorted by name',
                items: {
                  type: 'object',
                  properties: {
                    personId: { type: 'string' },
                    personName: { type: 'string' },
                    failedCount: { type: 'integer' },
                  },
                },
              },
              geocodingEnabled: { type: 'boolean' },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/map/geocode-retry': {
      post: {
        tags: ['Map'],
        summary: 'Retry geocoding an address',
        description:
          'Forces a fresh geocoder lookup for one address, bypassing the cached result. Used from the contact page when an address could not be located. Respects the instance kill switch and the user geocoding toggle.',
        security: [{ session: [] }],
        requestBody: zodBody(retryGeocodeSchema),
        responses: {
          '200': jsonResponse('Retry outcome', {
            type: 'object',
            properties: {
              outcome: {
                type: 'string',
                enum: ['success', 'failed', 'pending', 'skipped', 'rate_limited'],
              },
            },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
  };
}
