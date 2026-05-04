import { jsonResponse, ref401, refGraph } from './helpers';

export function dashboardPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/dashboard/stats': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get dashboard statistics',
        description:
          'Returns upcoming events (important dates and contact reminders due within 30 days), plus total people and group counts.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('Dashboard stats', {
            type: 'object',
            properties: {
              upcomingEvents: {
                type: 'array',
                items: { $ref: '#/components/schemas/UpcomingEvent' },
              },
              peopleCount: { type: 'integer' },
              groupsCount: { type: 'integer' },
            },
          }),
          '401': ref401(),
        },
      },
    },
    '/api/dashboard/graph': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get full network graph',
        description:
          'Returns a D3-compatible graph of all people and their relationships, centered on the user. Supports filtering by group inclusion and exclusion with configurable match modes.',
        security: [{ session: [] }],
        parameters: [
          {
            name: 'includeGroupIds',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
            style: 'form',
            description:
              'Comma-separated list of group IDs to include. People must belong to at least one (or all, depending on groupMatchOperator) of these groups.',
            explode: false,
          },
          {
            name: 'excludeGroupIds',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
            style: 'form',
            description:
              'Comma-separated list of group IDs to exclude. People in these groups will not be shown.',
            explode: false,
          },
          {
            name: 'groupMatchOperator',
            in: 'query',
            schema: { type: 'string', enum: ['and', 'or'], default: 'or' },
            description:
              'How to match included groups: "or" (any group) or "and" (all groups)',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Maximum number of people to include',
          },
        ],
        responses: {
          '200': refGraph(),
          '401': ref401(),
        },
      },
    },
  };
}
