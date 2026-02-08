import packageJson from '../package.json';

/* eslint-disable @typescript-eslint/no-explicit-any */

// OpenAPI 3.1.0 specification generator for the Nametag API.
// This is hand-crafted to avoid external dependencies while keeping
// the spec close to the actual route handlers.

export function generateOpenAPISpec() {
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
            deletedAt: { type: ['string', 'null'], format: 'date-time' },
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
            reminderType: { type: ['string', 'null'], enum: ['ONCE', 'RECURRING'] },
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
            titleKey: { type: ['string', 'null'], enum: ['timeToCatchUp', null] },
            date: { type: 'string', format: 'date-time' },
            daysUntil: { type: 'integer', description: 'Number of days until this event (negative = overdue)' },
          },
          required: ['id', 'personId', 'personName', 'type', 'title', 'titleKey', 'date', 'daysUntil'],
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
          type: ['string', 'null'],
          enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS', null],
        },
        ImportantDateInput: {
          type: 'object',
          description: 'Payload for creating or updating an important date',
          properties: {
            title: { type: 'string', maxLength: 100 },
            date: { type: 'string', format: 'date', description: 'ISO 8601 date string' },
            reminderEnabled: { type: 'boolean' },
            reminderType: { type: ['string', 'null'], enum: ['ONCE', 'RECURRING'] },
            reminderInterval: { type: ['integer', 'null'], minimum: 1, maximum: 99, description: 'How many units between reminders' },
            reminderIntervalUnit: {
              oneOf: [
                { $ref: '#/components/schemas/ReminderIntervalUnit' },
                { type: 'null' },
              ],
            },
          },
          required: ['title', 'date'],
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              email: { type: 'string', format: 'email' },
              password: { type: 'string', minLength: 8, description: 'Min 8 chars, must include uppercase, lowercase, number, and special character' },
              name: { type: 'string', maxLength: 100 },
              surname: { type: ['string', 'null'], maxLength: 100 },
              nickname: { type: ['string', 'null'], maxLength: 100 },
            },
            required: ['email', 'password', 'name'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: { email: { type: 'string', format: 'email' } },
            required: ['email'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              token: { type: 'string' },
              password: { type: 'string', minLength: 8 },
            },
            required: ['token', 'password'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: { email: { type: 'string', format: 'email' } },
            required: ['email'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: { email: { type: 'string', format: 'email' } },
            required: ['email'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 100 },
              surname: { type: ['string', 'null'], maxLength: 100 },
              middleName: { type: ['string', 'null'], maxLength: 100 },
              secondLastName: { type: ['string', 'null'], maxLength: 100 },
              nickname: { type: ['string', 'null'], maxLength: 100 },
              lastContact: { type: ['string', 'null'], format: 'date' },
              notes: { type: ['string', 'null'], maxLength: 10000 },
              relationshipToUserId: { type: ['string', 'null'], description: 'ID of the relationship type to the user' },
              groupIds: { type: 'array', items: { type: 'string' }, description: 'Group IDs to add this person to' },
              connectedThroughId: { type: 'string', description: 'If set, creates a person-to-person relationship instead of person-to-user' },
              importantDates: {
                type: 'array',
                items: { $ref: '#/components/schemas/ImportantDateInput' },
              },
              contactReminderEnabled: { type: 'boolean' },
              contactReminderInterval: { type: ['integer', 'null'], minimum: 1, maximum: 99 },
              contactReminderIntervalUnit: { $ref: '#/components/schemas/ReminderIntervalUnit' },
            },
            required: ['name'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            description: 'All fields are optional. Only provided fields are updated.',
            properties: {
              name: { type: 'string', maxLength: 100 },
              surname: { type: ['string', 'null'], maxLength: 100 },
              middleName: { type: ['string', 'null'], maxLength: 100 },
              secondLastName: { type: ['string', 'null'], maxLength: 100 },
              nickname: { type: ['string', 'null'], maxLength: 100 },
              lastContact: { type: ['string', 'null'], format: 'date' },
              notes: { type: ['string', 'null'], maxLength: 10000 },
              relationshipToUserId: { type: ['string', 'null'] },
              groupIds: { type: 'array', items: { type: 'string' } },
              importantDates: { type: 'array', items: { $ref: '#/components/schemas/ImportantDateInput' } },
              contactReminderEnabled: { type: 'boolean' },
              contactReminderInterval: { type: ['integer', 'null'], minimum: 1, maximum: 99 },
              contactReminderIntervalUnit: { $ref: '#/components/schemas/ReminderIntervalUnit' },
            },
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              deleteOrphans: { type: 'boolean', description: 'Also delete people only connected through this person' },
              orphanIds: { type: 'array', items: { type: 'string' }, description: 'Specific orphan IDs to delete' },
            },
          }),
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
          requestBody: jsonBody({ $ref: '#/components/schemas/ImportantDateInput' }),
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
          requestBody: jsonBody({ $ref: '#/components/schemas/ImportantDateInput' }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 100 },
              description: { type: ['string', 'null'], maxLength: 500 },
              color: { type: ['string', 'null'], description: 'Hex color (e.g. #FF5733)' },
              peopleIds: { type: 'array', items: { type: 'string' }, description: 'Person IDs to add as initial members' },
            },
            required: ['name'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 100 },
              description: { type: ['string', 'null'], maxLength: 500 },
              color: { type: ['string', 'null'] },
            },
            required: ['name'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              personId: { type: 'string', description: 'ID of the person to add' },
            },
            required: ['personId'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              personId: { type: 'string', description: 'First person ID' },
              relatedPersonId: { type: 'string', description: 'Second person ID' },
              relationshipTypeId: { type: 'string', description: 'Relationship type ID' },
              notes: { type: ['string', 'null'], maxLength: 1000 },
            },
            required: ['personId', 'relatedPersonId', 'relationshipTypeId'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              relationshipTypeId: { type: 'string' },
              notes: { type: ['string', 'null'], maxLength: 1000 },
            },
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 50, description: 'Internal name (will be upper-cased)' },
              label: { type: 'string', maxLength: 50, description: 'Display label' },
              color: { type: ['string', 'null'], description: 'Hex color' },
              inverseId: { type: ['string', 'null'], description: 'ID of existing inverse type' },
              inverseLabel: { type: 'string', maxLength: 50, description: 'Label for a new inverse type to auto-create' },
              symmetric: { type: 'boolean', description: 'If true, the type is its own inverse' },
            },
            required: ['name', 'label'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 50 },
              label: { type: 'string', maxLength: 50 },
              color: { type: ['string', 'null'] },
              inverseId: { type: ['string', 'null'] },
              inverseLabel: { type: 'string', maxLength: 50 },
              symmetric: { type: 'boolean' },
            },
            required: ['name', 'label'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: 100 },
              surname: { type: ['string', 'null'], maxLength: 100 },
              nickname: { type: ['string', 'null'], maxLength: 100 },
              email: { type: 'string', format: 'email' },
            },
            required: ['name', 'email'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: {
              currentPassword: { type: 'string' },
              newPassword: { type: 'string', minLength: 8 },
            },
            required: ['currentPassword', 'newPassword'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: { theme: { type: 'string', enum: ['LIGHT', 'DARK'] } },
            required: ['theme'],
          }),
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
          requestBody: jsonBody({
            type: 'object',
            properties: { dateFormat: { type: 'string', enum: ['MDY', 'DMY', 'YMD'] } },
            required: ['dateFormat'],
          }),
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
          requestBody: jsonBody({ type: 'object', description: 'Export-format JSON data' }),
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
                subscription: { type: 'object' },
                tierInfo: { type: 'object' },
                usage: { type: 'object' },
                limits: { type: 'object' },
                promotion: { type: ['object', 'null'] },
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
                tier: { type: 'string' },
                usage: { type: 'object' },
                limits: { type: 'object' },
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
                payments: { type: 'array', items: { type: 'object' } },
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
    },
  } as any;
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

function jsonBody(schema: any) {
  // Add ImportantDateInput to component schemas if referenced
  return {
    required: true,
    content: {
      'application/json': { schema },
    },
  };
}

function jsonResponse(description: string, schema: any) {
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
