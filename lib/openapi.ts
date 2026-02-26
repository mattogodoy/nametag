import { z } from 'zod';
import packageJson from '../package.json';
import {
  registerSchema, forgotPasswordSchema, resetPasswordSchema,
  resendVerificationSchema, checkVerificationSchema,
  createPersonSchema, updatePersonSchema, deletePersonSchema,
  createGroupSchema, updateGroupSchema, addGroupMemberSchema,
  createRelationshipSchema, updateRelationshipSchema,
  createRelationshipTypeSchema, updateRelationshipTypeSchema,
  updateProfileSchema, updatePasswordSchema,
  updateThemeSchema, updateDateFormatSchema,
  importDataSchema, createImportantDateSchema, updateImportantDateSchema,
} from './validations';

// OpenAPI 3.1.0 specification generator for the Nametag API.
// Request body schemas are generated from Zod validation schemas (single source of truth).
// Response schemas, component schemas, and endpoint metadata are hand-crafted.

type JsonSchema = Record<string, unknown>;

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
      { name: 'Dashboard', description: 'Dashboard statistics, upcoming events, and network graph' },
      { name: 'User Settings', description: 'Profile, preferences, data export/import, and account management' },
      { name: 'Billing', description: 'Subscription management, checkout, and payment history (SaaS mode only)' },
      { name: 'Deleted Items', description: 'View and restore soft-deleted items' },
      { name: 'CardDAV', description: 'CardDAV server connection, bidirectional sync, import/export, and conflict resolution' },
      { name: 'vCard', description: 'Direct vCard file import and upload for preview' },
      { name: 'Photos', description: 'Person photo retrieval' },
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
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'Human-readable error message' },
          },
          required: ['error'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Dot-separated field path' },
                  message: { type: 'string' },
                },
              },
            },
          },
          required: ['error', 'details'],
        },
        Message: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true] },
          },
          required: ['success'],
        },
        Person: {
          type: 'object',
          description: 'A person (contact) in your network',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            userId: { type: 'string', description: 'CUID identifier' },
            name: { type: 'string', description: 'First name' },
            surname: { type: ['string', 'null'] },
            middleName: { type: ['string', 'null'] },
            secondLastName: { type: ['string', 'null'] },
            nickname: { type: ['string', 'null'] },
            lastContact: { type: ['string', 'null'], format: 'date-time', description: 'Date of last contact' },
            notes: { type: ['string', 'null'], description: 'Markdown-formatted notes' },
            relationshipToUserId: { type: ['string', 'null'], description: 'ID of the relationship type to the user' },
            contactReminderEnabled: { type: 'boolean' },
            contactReminderInterval: { type: ['integer', 'null'], minimum: 1, maximum: 99 },
            contactReminderIntervalUnit: {
              oneOf: [
                { $ref: '#/components/schemas/ReminderIntervalUnit' },
                { type: 'null' },
              ],
            },
            relationshipToUser: {
              oneOf: [
                { $ref: '#/components/schemas/RelationshipTypeSummary' },
                { type: 'null' },
              ],
            },
            lastContactReminderSent: { type: ['string', 'null'], format: 'date-time' },
            cardDavSyncEnabled: { type: 'boolean' },
            prefix: { type: ['string', 'null'], description: 'Honorific prefix (Dr., Mr.)' },
            suffix: { type: ['string', 'null'], description: 'Honorific suffix (Jr., III)' },
            uid: { type: ['string', 'null'], description: 'vCard UID for CardDAV sync' },
            organization: { type: ['string', 'null'], description: 'Company / organization' },
            jobTitle: { type: ['string', 'null'], description: 'Job title' },
            photo: { type: ['string', 'null'], description: 'Photo URL or file reference' },
            gender: { type: ['string', 'null'] },
            anniversary: { type: ['string', 'null'], format: 'date-time' },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
            phoneNumbers: { type: 'array', items: { $ref: '#/components/schemas/PersonPhone' } },
            emails: { type: 'array', items: { $ref: '#/components/schemas/PersonEmail' } },
            addresses: { type: 'array', items: { $ref: '#/components/schemas/PersonAddress' } },
            urls: { type: 'array', items: { $ref: '#/components/schemas/PersonUrl' } },
            imHandles: { type: 'array', items: { $ref: '#/components/schemas/PersonIM' } },
            locations: { type: 'array', items: { $ref: '#/components/schemas/PersonLocation' } },
            customFields: { type: 'array', items: { $ref: '#/components/schemas/PersonCustomField' } },
            groups: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  personId: { type: 'string' },
                  groupId: { type: 'string' },
                  addedAt: { type: 'string', format: 'date-time' },
                  group: { $ref: '#/components/schemas/Group' },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'createdAt', 'updatedAt'],
        },
        Group: {
          type: 'object',
          description: 'A user-defined group for organizing people',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            userId: { type: 'string', description: 'CUID identifier' },
            name: { type: 'string' },
            description: { type: ['string', 'null'] },
            color: { type: ['string', 'null'], description: 'Hex color, e.g. #FF5733' },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'createdAt', 'updatedAt'],
        },
        Relationship: {
          type: 'object',
          description: 'A directional connection between two people',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string', description: 'CUID identifier' },
            relatedPersonId: { type: 'string', description: 'CUID identifier' },
            relationshipTypeId: { type: ['string', 'null'], description: 'CUID identifier' },
            notes: { type: ['string', 'null'] },
            person: {
              oneOf: [
                { $ref: '#/components/schemas/PersonSummary' },
                { type: 'null' },
              ],
            },
            relatedPerson: {
              oneOf: [
                { $ref: '#/components/schemas/PersonSummary' },
                { type: 'null' },
              ],
            },
            relationshipType: {
              oneOf: [
                { $ref: '#/components/schemas/RelationshipTypeSummary' },
                { type: 'null' },
              ],
            },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'relatedPersonId', 'createdAt', 'updatedAt'],
        },
        RelationshipType: {
          type: 'object',
          description: 'A custom type for categorizing relationships (e.g. Parent/Child, Friend)',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            name: { type: 'string', description: 'Internal name (UPPER_SNAKE_CASE)' },
            label: { type: 'string', description: 'Human-readable display label' },
            color: { type: ['string', 'null'], description: 'Hex color' },
            inverseId: { type: ['string', 'null'], description: 'CUID – ID of the inverse type (e.g. Child for Parent)' },
            inverse: {
              oneOf: [
                { $ref: '#/components/schemas/RelationshipTypeSummary' },
                { type: 'null' },
              ],
            },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'label', 'createdAt', 'updatedAt'],
        },
        RelationshipTypeSummary: {
          type: ['object', 'null'],
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            userId: { type: 'string', description: 'CUID identifier' },
            name: { type: 'string' },
            label: { type: 'string' },
            color: { type: ['string', 'null'] },
            inverseId: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        PersonSummary: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            name: { type: 'string' },
            surname: { type: ['string', 'null'] },
            middleName: { type: ['string', 'null'] },
            secondLastName: { type: ['string', 'null'] },
            nickname: { type: ['string', 'null'] },
          },
          required: ['id', 'name'],
        },
        ImportantDate: {
          type: 'object',
          description: 'A significant date for a person, with optional recurring reminders',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string', description: 'CUID identifier' },
            title: { type: 'string', description: 'Label for this date (e.g. Birthday, Anniversary)' },
            date: { type: 'string', format: 'date-time' },
            reminderEnabled: { type: 'boolean' },
            reminderType: {
              oneOf: [
                { type: 'string', enum: ['ONCE', 'RECURRING'] },
                { type: 'null' },
              ],
            },
            reminderInterval: { type: ['integer', 'null'], minimum: 1, maximum: 99 },
            reminderIntervalUnit: {
              oneOf: [
                { $ref: '#/components/schemas/ReminderIntervalUnit' },
                { type: 'null' },
              ],
            },
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'title', 'date', 'createdAt', 'updatedAt'],
        },
        UpcomingEvent: {
          type: 'object',
          description: 'An upcoming event computed from important dates and contact reminders',
          properties: {
            id: { type: 'string' },
            personId: { type: 'string', description: 'CUID identifier' },
            personName: { type: 'string' },
            type: { type: 'string', enum: ['important_date', 'contact_reminder'] },
            title: { type: ['string', 'null'] },
            titleKey: {
              oneOf: [
                { type: 'string', enum: ['timeToCatchUp'] },
                { type: 'null' },
              ],
            },
            date: { type: 'string', format: 'date-time' },
            daysUntil: { type: 'integer', description: 'Number of days until this event (negative = overdue)' },
            isYearUnknown: { type: 'boolean', description: 'Whether the original date has an unknown year (e.g. birthday without year)' },
          },
          required: ['id', 'personId', 'personName', 'type', 'title', 'titleKey', 'date', 'daysUntil', 'isYearUnknown'],
        },
        GraphNode: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            groups: { type: 'array', items: { type: 'string' } },
            colors: { type: 'array', items: { type: 'string' } },
            isCenter: { type: 'boolean' },
          },
          required: ['id', 'label', 'groups', 'colors', 'isCenter'],
        },
        GraphEdge: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            target: { type: 'string' },
            type: { type: 'string' },
            color: { type: 'string' },
          },
          required: ['source', 'target', 'type', 'color'],
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            surname: { type: ['string', 'null'] },
            nickname: { type: ['string', 'null'] },
            theme: { type: 'string', enum: ['LIGHT', 'DARK'] },
            dateFormat: { type: 'string', enum: ['MDY', 'DMY', 'YMD'] },
            language: { type: 'string', description: 'Locale code (e.g. en, es-ES, ja-JP, nb-NO, de-DE)' },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'email', 'name', 'theme', 'dateFormat', 'language', 'createdAt', 'updatedAt'],
        },
        ReminderIntervalUnit: {
          type: 'string',
          enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'],
        },
        PersonPhone: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            type: { type: 'string', description: 'Phone type (e.g. home, work, mobile, custom)' },
            number: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'type', 'number'],
        },
        PersonEmail: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            type: { type: 'string', description: 'Email type (e.g. home, work, custom)' },
            email: { type: 'string', format: 'email' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'type', 'email'],
        },
        PersonAddress: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            type: { type: 'string', description: 'Address type (e.g. home, work, custom)' },
            streetLine1: { type: ['string', 'null'] },
            streetLine2: { type: ['string', 'null'] },
            locality: { type: ['string', 'null'], description: 'City' },
            region: { type: ['string', 'null'], description: 'State/Province' },
            postalCode: { type: ['string', 'null'] },
            country: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'type'],
        },
        PersonUrl: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            type: { type: 'string', description: 'URL type (e.g. homepage, blog, custom)' },
            url: { type: 'string', format: 'uri' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'type', 'url'],
        },
        PersonIM: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            protocol: { type: 'string', description: 'IM protocol (e.g. skype, whatsapp, telegram, signal, other)' },
            handle: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'protocol', 'handle'],
        },
        PersonLocation: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            type: { type: 'string', description: 'Location type (e.g. home, work, other)' },
            latitude: { type: 'number', format: 'double' },
            longitude: { type: 'number', format: 'double' },
            label: { type: ['string', 'null'], description: 'Optional label (e.g. Main Office)' },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'type', 'latitude', 'longitude'],
        },
        PersonCustomField: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            personId: { type: 'string' },
            key: { type: 'string', description: 'Field key (e.g. X-SPOUSE)' },
            value: { type: 'string' },
            type: { type: ['string', 'null'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'personId', 'key', 'value'],
        },
        CardDavConnection: {
          type: 'object',
          description: 'A CardDAV server connection (password excluded from responses)',
          properties: {
            id: { type: 'string', description: 'CUID identifier' },
            userId: { type: 'string' },
            serverUrl: { type: 'string', format: 'uri' },
            username: { type: 'string' },
            provider: { type: ['string', 'null'], description: 'Provider hint: google, icloud, outlook, nextcloud, custom' },
            syncEnabled: { type: 'boolean' },
            autoSyncInterval: { type: 'integer', description: 'Sync interval in seconds (60–86400)' },
            lastSyncAt: { type: ['string', 'null'], format: 'date-time' },
            autoExportNew: { type: 'boolean' },
            importMode: { type: 'string', enum: ['manual', 'notify', 'auto'] },
            lastError: { type: ['string', 'null'] },
            lastErrorAt: { type: ['string', 'null'], format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'userId', 'serverUrl', 'username', 'syncEnabled', 'autoExportNew', 'importMode', 'createdAt', 'updatedAt'],
        },
      },
    },
    paths: {
      // =====================================================
      // Auth
      // =====================================================
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new account',
          description: 'Creates a new user account. May send a verification email if email verification is enabled.',
          requestBody: zodBody(registerSchema),
          responses: {
            '201': jsonResponse('Account created', {
              type: 'object',
              properties: {
                message: { type: 'string' },
                user: {
                  type: 'object',
                  properties: { id: { type: 'string' }, email: { type: 'string' }, name: { type: 'string' } },
                },
              },
            }),
            '400': ref400(),
            '429': resp('Rate limited'),
          },
        },
      },
      '/api/auth/verify-email': {
        post: {
          tags: ['Auth'],
          summary: 'Verify email address',
          description: 'Confirms the user\'s email using the token sent during registration.',
          requestBody: jsonBody({
            type: 'object',
            properties: { token: { type: 'string' } },
            required: ['token'],
          }),
          responses: {
            '200': refMessage(),
            '400': ref400(),
          },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset',
          description: 'Sends a password reset email to the specified address if the account exists.',
          requestBody: zodBody(forgotPasswordSchema),
          responses: {
            '200': refMessage(),
            '429': resp('Rate limited'),
          },
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token',
          description: 'Sets a new password using a valid reset token.',
          requestBody: zodBody(resetPasswordSchema),
          responses: {
            '200': refMessage(),
            '400': ref400(),
          },
        },
      },
      '/api/auth/check-verification': {
        post: {
          tags: ['Auth'],
          summary: 'Check if an email is verified',
          description: 'Returns whether the given email address has been verified.',
          requestBody: zodBody(checkVerificationSchema),
          responses: {
            '200': jsonResponse('Verification status', {
              type: 'object',
              properties: { verified: { type: 'boolean' } },
            }),
          },
        },
      },
      '/api/auth/resend-verification': {
        post: {
          tags: ['Auth'],
          summary: 'Resend verification email',
          description: 'Sends a new verification email to the specified address.',
          requestBody: zodBody(resendVerificationSchema),
          responses: {
            '200': refMessage(),
            '429': resp('Rate limited'),
          },
        },
      },
      '/api/auth/registration-status': {
        get: {
          tags: ['Auth'],
          summary: 'Check if registration is enabled',
          description: 'Returns whether new user registration is currently allowed on this instance.',
          responses: {
            '200': jsonResponse('Registration status', {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                message: { type: 'string' },
              },
            }),
          },
        },
      },
      '/api/auth/available-providers': {
        get: {
          tags: ['Auth'],
          summary: 'List available authentication providers',
          description: 'Returns which login methods (credentials, Google OAuth) are enabled on this instance.',
          responses: {
            '200': jsonResponse('Available providers', {
              type: 'object',
              properties: {
                providers: {
                  type: 'object',
                  properties: {
                    credentials: { type: 'boolean' },
                    google: { type: 'boolean' },
                  },
                },
              },
            }),
          },
        },
      },

      // =====================================================
      // People
      // =====================================================
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

      // =====================================================
      // Important Dates
      // =====================================================
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

      // =====================================================
      // Groups
      // =====================================================
      '/api/groups': {
        get: {
          tags: ['Groups'],
          summary: 'List all groups',
          description: 'Returns all groups for the authenticated user, with their members.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('List of groups', {
              type: 'object',
              properties: {
                groups: { type: 'array', items: { $ref: '#/components/schemas/Group' } },
              },
            }),
            '401': ref401(),
          },
        },
        post: {
          tags: ['Groups'],
          summary: 'Create a new group',
          description: 'Creates a group with a name, optional description/color, and optional initial members.',
          security: [{ session: [] }],
          requestBody: zodBody(createGroupSchema),
          responses: {
            '201': jsonResponse('Group created', {
              type: 'object',
              properties: { group: { $ref: '#/components/schemas/Group' } },
            }),
            '400': ref400(),
            '401': ref401(),
            '403': resp('Plan limit reached'),
          },
        },
      },
      '/api/groups/{id}': {
        get: {
          tags: ['Groups'],
          summary: 'Get a group by ID',
          description: 'Returns a single group with its member list.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Group ID')],
          responses: {
            '200': jsonResponse('Group details', {
              type: 'object',
              properties: { group: { $ref: '#/components/schemas/Group' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
        put: {
          tags: ['Groups'],
          summary: 'Update a group',
          description: 'Updates the name, description, and/or color of a group.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Group ID')],
          requestBody: zodBody(updateGroupSchema),
          responses: {
            '200': jsonResponse('Group updated', {
              type: 'object',
              properties: { group: { $ref: '#/components/schemas/Group' } },
            }),
            '400': ref400(),
            '401': ref401(),
            '404': ref404(),
          },
        },
        delete: {
          tags: ['Groups'],
          summary: 'Delete a group',
          description: 'Soft-deletes a group. Optionally also soft-deletes all people in the group.',
          security: [{ session: [] }],
          parameters: [
            pathParam('id', 'Group ID'),
            { name: 'deletePeople', in: 'query', schema: { type: 'boolean' }, description: 'Also delete all people in this group' },
          ],
          responses: {
            '200': refMessage(),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/groups/{id}/restore': {
        post: {
          tags: ['Groups'],
          summary: 'Restore a deleted group',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Group ID')],
          responses: {
            '200': jsonResponse('Group restored', {
              type: 'object',
              properties: { group: { $ref: '#/components/schemas/Group' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/groups/{id}/members': {
        post: {
          tags: ['Groups'],
          summary: 'Add a person to a group',
          description: 'Adds an existing person as a member of the specified group.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Group ID')],
          requestBody: zodBody(addGroupMemberSchema),
          responses: {
            '200': refSuccess(),
            '400': ref400(),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/groups/{id}/members/{personId}': {
        delete: {
          tags: ['Groups'],
          summary: 'Remove a person from a group',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Group ID'), pathParam('personId', 'Person ID')],
          responses: {
            '200': refSuccess(),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },

      // =====================================================
      // Relationships
      // =====================================================
      '/api/relationships': {
        get: {
          tags: ['Relationships'],
          summary: 'List all relationships',
          description: 'Returns all relationships between people in the authenticated user\'s network, including person and type details.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('List of relationships', {
              type: 'object',
              properties: {
                relationships: { type: 'array', items: { $ref: '#/components/schemas/Relationship' } },
              },
            }),
            '401': ref401(),
          },
        },
        post: {
          tags: ['Relationships'],
          summary: 'Create a relationship',
          description: 'Creates a bidirectional relationship between two people. Automatically creates the inverse relationship.',
          security: [{ session: [] }],
          requestBody: zodBody(createRelationshipSchema),
          responses: {
            '201': jsonResponse('Relationship created', {
              type: 'object',
              properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
            }),
            '400': ref400(),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/relationships/{id}': {
        get: {
          tags: ['Relationships'],
          summary: 'Get a relationship by ID',
          description: 'Returns a single relationship with person and type details.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship ID')],
          responses: {
            '200': jsonResponse('Relationship details', {
              type: 'object',
              properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
        put: {
          tags: ['Relationships'],
          summary: 'Update a relationship',
          description: 'Changes the type and/or notes of an existing relationship. Also updates the inverse relationship.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship ID')],
          requestBody: zodBody(updateRelationshipSchema),
          responses: {
            '200': jsonResponse('Relationship updated', {
              type: 'object',
              properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
            }),
            '400': ref400(),
            '401': ref401(),
            '404': ref404(),
          },
        },
        delete: {
          tags: ['Relationships'],
          summary: 'Delete a relationship',
          description: 'Soft-deletes a relationship and its inverse.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship ID')],
          responses: {
            '200': refMessage(),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/relationships/{id}/restore': {
        post: {
          tags: ['Relationships'],
          summary: 'Restore a deleted relationship',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship ID')],
          responses: {
            '200': jsonResponse('Relationship restored', {
              type: 'object',
              properties: { relationship: { $ref: '#/components/schemas/Relationship' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },

      // =====================================================
      // Relationship Types
      // =====================================================
      '/api/relationship-types': {
        get: {
          tags: ['Relationship Types'],
          summary: 'List all relationship types',
          description: 'Returns all custom relationship types for the user, including inverse type info.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('List of relationship types', {
              type: 'object',
              properties: {
                relationshipTypes: { type: 'array', items: { $ref: '#/components/schemas/RelationshipType' } },
              },
            }),
            '401': ref401(),
          },
        },
        post: {
          tags: ['Relationship Types'],
          summary: 'Create a relationship type',
          description: 'Creates a new relationship type. Can be symmetric (e.g. Friend <-> Friend) or asymmetric with an inverse (e.g. Parent -> Child). If inverseLabel is provided, the inverse type is auto-created.',
          security: [{ session: [] }],
          requestBody: zodBody(createRelationshipTypeSchema),
          responses: {
            '201': jsonResponse('Relationship type created', {
              type: 'object',
              properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
            }),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },
      '/api/relationship-types/{id}': {
        get: {
          tags: ['Relationship Types'],
          summary: 'Get a relationship type by ID',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship type ID')],
          responses: {
            '200': jsonResponse('Relationship type details', {
              type: 'object',
              properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
        put: {
          tags: ['Relationship Types'],
          summary: 'Update a relationship type',
          description: 'Updates label, color, inverse, or symmetric status of a relationship type.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship type ID')],
          requestBody: zodBody(updateRelationshipTypeSchema),
          responses: {
            '200': jsonResponse('Relationship type updated', {
              type: 'object',
              properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
            }),
            '400': ref400(),
            '401': ref401(),
            '404': ref404(),
          },
        },
        delete: {
          tags: ['Relationship Types'],
          summary: 'Delete a relationship type',
          description: 'Soft-deletes a relationship type. Fails if the type is currently in use by any relationships.',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship type ID')],
          responses: {
            '200': refSuccess(),
            '400': resp('Type is in use'),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },
      '/api/relationship-types/{id}/restore': {
        post: {
          tags: ['Relationship Types'],
          summary: 'Restore a deleted relationship type',
          security: [{ session: [] }],
          parameters: [pathParam('id', 'Relationship type ID')],
          responses: {
            '200': jsonResponse('Relationship type restored', {
              type: 'object',
              properties: { relationshipType: { $ref: '#/components/schemas/RelationshipType' } },
            }),
            '401': ref401(),
            '404': ref404(),
          },
        },
      },

      // =====================================================
      // Dashboard
      // =====================================================
      '/api/dashboard/stats': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get dashboard statistics',
          description: 'Returns upcoming events (important dates and contact reminders due within 30 days), plus total people and group counts.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('Dashboard stats', {
              type: 'object',
              properties: {
                upcomingEvents: { type: 'array', items: { $ref: '#/components/schemas/UpcomingEvent' } },
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
          description: 'Returns a D3-compatible graph of all people and their relationships, centered on the user. Supports filtering by group.',
          security: [{ session: [] }],
          parameters: [
            { name: 'groupIds', in: 'query', schema: { type: 'array', items: { type: 'string' } }, description: 'Filter to people in these groups', explode: true },
            { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Maximum number of people to include' },
          ],
          responses: {
            '200': refGraph(),
            '401': ref401(),
          },
        },
      },

      // =====================================================
      // User Settings
      // =====================================================
      '/api/user/profile': {
        get: {
          tags: ['User Settings'],
          summary: 'Get current user profile',
          description: 'Returns the authenticated user\'s profile information and preferences.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('User profile', {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/UserProfile' } },
            }),
            '401': ref401(),
          },
        },
        put: {
          tags: ['User Settings'],
          summary: 'Update user profile',
          description: 'Updates name, surname, nickname, and/or email. If email is changed, a verification email is sent and the account is marked as unverified.',
          security: [{ session: [] }],
          requestBody: zodBody(updateProfileSchema),
          responses: {
            '200': jsonResponse('Profile updated', {
              type: 'object',
              properties: {
                user: { $ref: '#/components/schemas/UserProfile' },
                emailChanged: { type: 'boolean' },
              },
            }),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },
      '/api/user/password': {
        put: {
          tags: ['User Settings'],
          summary: 'Change password',
          description: 'Changes the user\'s password. Requires the current password for verification.',
          security: [{ session: [] }],
          requestBody: zodBody(updatePasswordSchema),
          responses: {
            '200': refMessage(),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },
      '/api/user/theme': {
        put: {
          tags: ['User Settings'],
          summary: 'Update theme preference',
          security: [{ session: [] }],
          requestBody: zodBody(updateThemeSchema),
          responses: {
            '200': jsonResponse('Theme updated', {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/UserProfile' } },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/user/date-format': {
        put: {
          tags: ['User Settings'],
          summary: 'Update date format preference',
          security: [{ session: [] }],
          requestBody: zodBody(updateDateFormatSchema),
          responses: {
            '200': jsonResponse('Date format updated', {
              type: 'object',
              properties: { user: { $ref: '#/components/schemas/UserProfile' } },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/user/language': {
        put: {
          tags: ['User Settings'],
          summary: 'Update language preference',
          security: [{ session: [] }],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              language: { type: 'string', enum: ['en', 'es-ES', 'ja-JP', 'nb-NO', 'de-DE'] },
            },
            required: ['language'],
          }),
          responses: {
            '200': jsonResponse('Language updated', {
              type: 'object',
              properties: { success: { type: 'boolean' }, language: { type: 'string' } },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/user/export': {
        get: {
          tags: ['User Settings'],
          summary: 'Export user data',
          description: 'Exports all user data (people, groups, relationships, relationship types) as JSON. Optionally filter by groups.',
          security: [{ session: [] }],
          parameters: [
            { name: 'groupIds', in: 'query', schema: { type: 'string' }, description: 'Comma-separated group IDs to filter export' },
          ],
          responses: {
            '200': jsonResponse('Exported data', {
              type: 'object',
              properties: {
                version: { type: 'string' },
                exportDate: { type: 'string', format: 'date-time' },
                user: { type: 'object' },
                groups: { type: 'array', items: { type: 'object' } },
                people: { type: 'array', items: { type: 'object' } },
                relationshipTypes: { type: 'array', items: { type: 'object' } },
              },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/user/import/validate': {
        post: {
          tags: ['User Settings'],
          summary: 'Validate import data',
          description: 'Validates a data import payload without actually importing. Returns counts and conflict information.',
          security: [{ session: [] }],
          requestBody: jsonBody({ type: 'object', description: 'Export-format JSON data' }),
          responses: {
            '200': jsonResponse('Validation result', {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                newPeopleCount: { type: 'integer' },
                newGroupsCount: { type: 'integer' },
              },
            }),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },
      '/api/user/import': {
        post: {
          tags: ['User Settings'],
          summary: 'Import user data',
          description: 'Imports people, groups, relationships, and relationship types from a Nametag export JSON file.',
          security: [{ session: [] }],
          requestBody: zodBody(importDataSchema),
          responses: {
            '200': jsonResponse('Import result', {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                imported: {
                  type: 'object',
                  properties: {
                    groups: { type: 'integer' },
                    people: { type: 'integer' },
                    relationshipTypes: { type: 'integer' },
                  },
                },
              },
            }),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },
      '/api/user/delete': {
        delete: {
          tags: ['User Settings'],
          summary: 'Delete account',
          description: 'Permanently deletes the user account and all associated data. Requires typing "DELETE" to confirm.',
          security: [{ session: [] }],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              password: { type: 'string', description: 'Current password (required for credential accounts)' },
              confirmationText: { type: 'string', description: 'Must be exactly "DELETE"' },
            },
            required: ['confirmationText'],
          }),
          responses: {
            '200': refMessage(),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },

      // =====================================================
      // Billing (SaaS mode only)
      // =====================================================
      '/api/billing/subscription': {
        get: {
          tags: ['Billing'],
          summary: 'Get subscription details',
          description: 'Returns the current subscription status, tier info, usage, limits, and active promotion.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('Subscription details', {
              type: 'object',
              properties: {
                subscription: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        tier: { type: 'string', enum: ['FREE', 'PERSONAL', 'PRO'] },
                        status: { type: 'string' },
                        billingFrequency: { type: 'string', enum: ['MONTHLY', 'YEARLY'] },
                        tierStartedAt: { type: ['string', 'null'], format: 'date-time' },
                        currentPeriodStart: { type: ['string', 'null'], format: 'date-time' },
                        currentPeriodEnd: { type: ['string', 'null'], format: 'date-time' },
                        cancelAtPeriodEnd: { type: 'boolean' },
                      },
                    },
                    { type: 'null' },
                  ],
                },
                tierInfo: { type: 'object', description: 'Display metadata for the current tier (name, features, pricing)' },
                usage: { type: 'object', description: 'Current usage counts (people, groups, reminders)' },
                limits: { type: 'object', description: 'Plan limits for each resource' },
                promotion: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        code: { type: 'string' },
                        description: { type: 'string' },
                        discountPercent: { type: 'number' },
                        isActive: { type: 'boolean' },
                        expiresAt: { type: ['string', 'null'], format: 'date-time' },
                      },
                    },
                    { type: 'null' },
                  ],
                },
              },
            }),
            '401': ref401(),
            '404': resp('Not available (self-hosted mode)'),
          },
        },
      },
      '/api/billing/checkout': {
        post: {
          tags: ['Billing'],
          summary: 'Create a checkout session',
          description: 'Creates a Stripe checkout session for subscribing to a paid plan.',
          security: [{ session: [] }],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              tier: { type: 'string', enum: ['PERSONAL', 'PRO'] },
              frequency: { type: 'string', enum: ['MONTHLY', 'YEARLY'] },
              promotionCode: { type: 'string', description: 'Optional promotion code' },
            },
            required: ['tier', 'frequency'],
          }),
          responses: {
            '200': jsonResponse('Checkout URL', {
              type: 'object',
              properties: { url: { type: 'string', format: 'uri' } },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/billing/usage': {
        get: {
          tags: ['Billing'],
          summary: 'Get current usage',
          description: 'Returns usage counts against plan limits.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('Usage info', {
              type: 'object',
              properties: {
                tier: { type: 'string', enum: ['FREE', 'PERSONAL', 'PRO'] },
                usage: { type: 'object', description: 'Current usage counts (people, groups, reminders)' },
                limits: { type: 'object', description: 'Plan limits for each resource' },
              },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/billing/history': {
        get: {
          tags: ['Billing'],
          summary: 'Get payment history',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('Payment history', {
              type: 'object',
              properties: {
                payments: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      amount: { type: 'number', description: 'Amount in cents' },
                      currency: { type: 'string', description: 'ISO 4217 currency code (e.g. usd)' },
                      status: { type: 'string' },
                      description: { type: 'string' },
                      originalAmount: { type: 'number' },
                      discountAmount: { type: 'number' },
                      promotionCode: { type: ['string', 'null'] },
                      paidAt: { type: ['string', 'null'], format: 'date-time' },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/billing/portal': {
        post: {
          tags: ['Billing'],
          summary: 'Open Stripe billing portal',
          description: 'Returns a URL to the Stripe customer portal for managing payment methods and invoices.',
          security: [{ session: [] }],
          responses: {
            '200': jsonResponse('Portal URL', {
              type: 'object',
              properties: { url: { type: 'string', format: 'uri' } },
            }),
            '401': ref401(),
          },
        },
      },
      '/api/billing/cancel': {
        post: {
          tags: ['Billing'],
          summary: 'Cancel subscription',
          security: [{ session: [] }],
          requestBody: jsonBody({
            type: 'object',
            properties: {
              immediately: { type: 'boolean', description: 'Cancel now instead of at period end' },
              reason: { type: 'string', description: 'Optional cancellation reason' },
            },
          }),
          responses: {
            '200': refMessage(),
            '401': ref401(),
          },
        },
      },
      '/api/billing/apply-promotion': {
        post: {
          tags: ['Billing'],
          summary: 'Apply a promotion code',
          security: [{ session: [] }],
          requestBody: jsonBody({
            type: 'object',
            properties: { code: { type: 'string' } },
            required: ['code'],
          }),
          responses: {
            '200': refMessage(),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },

      // =====================================================
      // Deleted Items
      // =====================================================
      '/api/deleted': {
        get: {
          tags: ['Deleted Items'],
          summary: 'List soft-deleted items',
          description: 'Returns items deleted within the retention period (30 days), filtered by type.',
          security: [{ session: [] }],
          parameters: [
            {
              name: 'type',
              in: 'query',
              required: true,
              schema: { type: 'string', enum: ['people', 'groups', 'relationships', 'relationshipTypes', 'importantDates'] },
              description: 'Entity type to list',
            },
          ],
          responses: {
            '200': jsonResponse('Deleted items', {
              type: 'object',
              properties: {
                deleted: { type: 'array', items: { type: 'object' } },
                retentionDays: { type: 'integer' },
                cutoffDate: { type: 'string', format: 'date-time' },
              },
            }),
            '400': ref400(),
            '401': ref401(),
          },
        },
      },

      // =====================================================
      // CardDAV
      // =====================================================
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
            },
            required: ['importIds'],
          }),
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

      // =====================================================
      // vCard
      // =====================================================
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

      // =====================================================
      // Photos
      // =====================================================
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

      // =====================================================
      // Cron
      // =====================================================
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

      // =====================================================
      // System
      // =====================================================
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

// ---------------------------------------------------------------------------
// Helper functions to reduce repetition in the spec above
// ---------------------------------------------------------------------------

function pathParam(name: string, description: string) {
  return {
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
    description,
  };
}

function jsonBody(schema: JsonSchema) {
  return {
    required: true,
    content: {
      'application/json': { schema },
    },
  };
}

/** Generates an OpenAPI requestBody from a Zod schema via z.toJSONSchema(). */
function zodBody(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'throw',
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return {
    required: true as const,
    content: {
      'application/json': { schema: jsonSchema as JsonSchema },
    },
  };
}

function jsonResponse(description: string, schema: JsonSchema) {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

function resp(description: string) {
  return {
    description,
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  };
}

function ref400() {
  return resp('Validation error');
}

function ref401() {
  return resp('Unauthorized');
}

function ref404() {
  return resp('Not found');
}

function refMessage() {
  return {
    description: 'Success',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Message' } },
    },
  };
}

function refSuccess() {
  return {
    description: 'Success',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Success' } },
    },
  };
}

function refGraph() {
  return jsonResponse('Graph data', {
    type: 'object',
    properties: {
      nodes: { type: 'array', items: { $ref: '#/components/schemas/GraphNode' } },
      edges: { type: 'array', items: { $ref: '#/components/schemas/GraphEdge' } },
    },
  });
}
