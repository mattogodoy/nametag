import packageJson from '../../package.json';
import { sharedSchemas } from './schemas';
import { authPaths } from './auth';
import { peoplePaths } from './people';
import { groupsPaths } from './groups';
import { relationshipsPaths } from './relationships';
import { dashboardPaths } from './dashboard';
import { userPaths } from './user';
import { billingPaths } from './billing';
import { carddavPaths } from './carddav';
import { journalPaths } from './journal';
import { customFieldsPaths } from './customFields';
import { jsonResponse, ref400, ref401, ref404, pathParam, jsonBody, resp } from './helpers';

// OpenAPI 3.1.0 specification generator for the Nametag API.
// Request body schemas are generated from Zod validation schemas (single source of truth).
// Response schemas, component schemas, and endpoint metadata are hand-crafted.

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description: string; license: { name: string; url: string } };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: Record<string, unknown>;
  paths: Record<string, Record<string, unknown>>;
}

export function generateOpenAPISpec(): OpenAPISpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Nametag API',
      version: packageJson.version,
      description:
        'API for Nametag, a personal relationships manager. ' +
        'Track the people in your life, map relationships, manage groups, ' +
        'set reminders for important dates, and visualize your personal network.',
      license: {
        name: 'AGPL-3.0',
        url: 'https://www.gnu.org/licenses/agpl-3.0.html',
      },
    },
    servers: [
      {
        url: '/',
        description: 'Current instance',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Registration, login, password reset, and email verification' },
      { name: 'People', description: 'Manage people (contacts) in your network' },
      { name: 'Groups', description: 'Organize people into custom groups' },
      { name: 'Relationships', description: 'Connections between people in your network' },
      { name: 'Relationship Types', description: 'Custom types for relationships (e.g. Parent, Friend)' },
      { name: 'Important Dates', description: 'Birthdays, anniversaries, and other dates with optional reminders' },
      { name: 'Custom Fields', description: 'User-defined typed fields applied to people' },
      { name: 'Journal', description: 'Journal entries with optional people tags' },
      { name: 'Dashboard', description: 'Dashboard statistics, upcoming events, and network graph' },
      { name: 'User Settings', description: 'Profile, preferences, data export/import, and account management' },
      { name: 'Billing', description: 'Subscription management, checkout, and payment history (SaaS mode only)' },
      { name: 'Deleted Items', description: 'View and restore soft-deleted items' },
      { name: 'CardDAV', description: 'CardDAV server connection, bidirectional sync, import/export, and conflict resolution' },
      { name: 'vCard', description: 'Direct vCard file import and upload for preview' },
      { name: 'Photos', description: 'Person and user photo management' },
      { name: 'Cron', description: 'Background jobs authenticated via CRON_SECRET bearer token' },
      { name: 'System', description: 'Health checks and system endpoints' },
    ],
    components: {
      securitySchemes: {
        session: {
          type: 'apiKey',
          in: 'cookie',
          name: 'authjs.session-token',
          description: 'NextAuth.js session cookie obtained after login via /api/auth/callback/credentials',
        },
        cronBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Bearer token matching the CRON_SECRET environment variable. Used by background cron jobs.',
        },
      },
      schemas: sharedSchemas(),
    },
    paths: {
      ...authPaths(),
      ...peoplePaths(),
      ...groupsPaths(),
      ...relationshipsPaths(),
      ...dashboardPaths(),
      ...userPaths(),
      ...billingPaths(),
      ...carddavPaths(),
      ...journalPaths(),
      ...customFieldsPaths(),

      // Photos (non-person-specific)
      '/api/photos/{personId}': {
        get: {
          tags: ['Photos'],
          summary: 'Get person photo',
          description: 'Returns the photo image for a person. Served from disk with appropriate MIME type and caching headers.',
          security: [{ session: [] }],
          parameters: [pathParam('personId', 'Person ID')],
          responses: {
            '200': {
              description: 'Photo image',
              content: {
                'image/*': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '404': ref404(),
          },
        },
      },
      '/api/photos/user': {
        get: {
          tags: ['Photos'],
          summary: 'Get current user photo',
          description: 'Returns the photo image for the logged-in user.',
          security: [{ session: [] }],
          responses: {
            '200': {
              description: 'Photo image',
              content: {
                'image/*': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '401': ref401(),
            '404': ref404(),
          },
        },
      },

      // Cron (purge)
      '/api/cron/purge-deleted': {
        get: {
          tags: ['Cron'],
          summary: 'Purge old deleted records',
          description: 'Permanently deletes soft-deleted records older than the 30-day retention period. Deletes in foreign-key order and removes photo files from disk.',
          security: [{ cronBearer: [] }],
          responses: {
            '200': jsonResponse('Purge results', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                purged: {
                  type: 'object',
                  properties: {
                    importantDates: { type: 'integer' },
                    personGroups: { type: 'integer' },
                    relationships: { type: 'integer' },
                    groups: { type: 'integer' },
                    relationshipTypes: { type: 'integer' },
                    people: { type: 'integer' },
                  },
                },
                retentionDays: { type: 'integer' },
                cutoffDate: { type: 'string', format: 'date-time' },
              },
            }),
            '401': ref401(),
          },
        },
      },

      // System
      '/api/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Returns the health status of the application and its database connection.',
          responses: {
            '200': jsonResponse('Healthy', {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['healthy'] },
                timestamp: { type: 'string', format: 'date-time' },
                uptime: { type: 'number' },
                checks: {
                  type: 'object',
                  properties: {
                    database: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' },
                        latency: { type: 'string' },
                      },
                    },
                  },
                },
              },
            }),
            '503': resp('Unhealthy'),
          },
        },
      },
      '/api/unsubscribe': {
        post: {
          tags: ['System'],
          summary: 'Unsubscribe from email reminders',
          description: 'Disables a specific reminder using a one-time unsubscribe token from an email.',
          requestBody: jsonBody({
            type: 'object',
            properties: { token: { type: 'string' } },
            required: ['token'],
          }),
          responses: {
            '200': jsonResponse('Unsubscribed', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                reminderType: { type: 'string' },
              },
            }),
            '400': ref400(),
          },
        },
      },
      '/api/openapi.json': {
        get: {
          tags: ['System'],
          summary: 'OpenAPI specification',
          description: 'Returns this OpenAPI 3.1.0 specification document describing all available API endpoints.',
          responses: {
            '200': {
              description: 'OpenAPI spec',
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
      '/api/docs': {
        get: {
          tags: ['System'],
          summary: 'Swagger UI',
          description: 'Interactive API documentation powered by Swagger UI.',
          responses: {
            '200': {
              description: 'HTML page',
              content: { 'text/html': { schema: { type: 'string' } } },
            },
          },
        },
      },
      '/api/version': {
        get: {
          tags: ['System'],
          summary: 'Application version',
          description: 'Returns the current installed version of the application. Useful for monitoring tools like release-argus.',
          responses: {
            '200': jsonResponse('Version info', {
              type: 'object',
              properties: {
                version: { type: 'string', example: '0.17.1' },
              },
              required: ['version'],
            }),
          },
        },
      },
    },
  };
}
