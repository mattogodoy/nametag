import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import pkg from '../../package.json';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type NametagMcpServerOptions = {
  userId: string | null;
  apiBaseUrl: string;
  authHeader?: string;
  proxyApi?: boolean;
};

type ApiResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

const reminderIntervalUnitSchema = z.enum(['DAYS', 'WEEKS', 'MONTHS', 'YEARS']);
const reminderTypeSchema = z.enum(['ONCE', 'RECURRING']);

const importantDateInputSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
  reminderEnabled: z.boolean().optional(),
  reminderType: reminderTypeSchema.nullish(),
  reminderInterval: z.number().int().min(1).max(99).nullish(),
  reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
});

function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function jsonResult(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function getErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.error === 'string') return record.error;
  if (typeof record.message === 'string') return record.message;
  return undefined;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function createApiClient(baseUrl: string, authHeader?: string) {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return async function apiRequest<T>(
    method: string,
    path: string,
    options?: { query?: Record<string, string | number | boolean | undefined>; body?: unknown }
  ): Promise<ApiResult<T>> {
    const url = buildUrl(normalizedBase, path.replace(/^\//, ''), options?.query);
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (authHeader) {
      headers.Authorization = authHeader;
    }

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : undefined;

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          error: getErrorMessage(data) ?? `Request failed with status ${response.status}.`,
        };
      }

      return {
        ok: true,
        status: response.status,
        data,
      } as ApiResult<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, status: 0, error: message };
    }
  };
}

export function createNametagMcpServer(
  options: NametagMcpServerOptions = {
    userId: null,
    apiBaseUrl: 'http://127.0.0.1:3000',
    authHeader: undefined,
    proxyApi: true,
  }
): McpServer {
  const { apiBaseUrl, authHeader } = options;
  const apiRequest = createApiClient(apiBaseUrl, authHeader);
  const server = new McpServer(
    {
      name: 'nametag',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
      instructions:
        'Nametag MCP server proxies requests to the Nametag HTTP API. Provide a NextAuth session token via Authorization: Bearer <token>.',
    }
  );

  const requireAuthHeader = () => {
    if (!authHeader) {
      return errorResult('Unauthorized: missing Authorization header.');
    }
    return null;
  };

  server.registerTool(
    'list_people',
    {
      title: 'List people',
      description: 'List people in the authenticated user\'s network, ordered by most recently updated.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of people to return'),
      },
    },
    async ({ limit }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ people: Array<Record<string, unknown>> }>(
        'GET',
        '/api/people',
        { query: { orderBy: 'updatedAt', order: 'desc', limit } }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to list people.');
      }

      const people = response.data?.people ?? [];
      const mapped = people.map((person: any) => ({
        id: person.id,
        name: person.name,
        surname: person.surname,
        nickname: person.nickname,
        lastContact: person.lastContact,
        relationship: person.relationshipToUser?.label ?? null,
        updatedAt: person.updatedAt,
      }));

      return jsonResult(mapped);
    }
  );

  server.registerTool(
    'search_people',
    {
      title: 'Search people',
      description: 'Search people by name, surname, or nickname.',
      inputSchema: {
        query: z.string().min(1).describe('Search query'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of people to return'),
      },
    },
    async ({ query, limit }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ people: unknown[] }>('GET', '/api/people/search', {
        query: { q: query, limit },
      });

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to search people.');
      }

      return jsonResult(response.data?.people ?? []);
    }
  );

  server.registerTool(
    'get_person',
    {
      title: 'Get person details',
      description: 'Fetch a person record including groups and important dates.',
      inputSchema: {
        personId: z.string().describe('Person ID to fetch'),
      },
    },
    async ({ personId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ person: unknown }>('GET', `/api/people/${personId}`);
      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to fetch person.');
      }

      return jsonResult(response.data?.person ?? null);
    }
  );

  server.registerTool(
    'create_person',
    {
      title: 'Create person',
      description: 'Create a new person in the authenticated user\'s network.',
      inputSchema: {
        name: z.string().min(1).max(100),
        surname: z.string().max(100).nullable().optional(),
        middleName: z.string().max(100).nullable().optional(),
        secondLastName: z.string().max(100).nullable().optional(),
        nickname: z.string().max(100).nullable().optional(),
        lastContact: z.string().nullable().optional(),
        notes: z.string().max(10000).nullable().optional(),
        relationshipToUserId: z.string().nullable().optional(),
        groupIds: z.array(z.string()).optional(),
        connectedThroughId: z.string().optional(),
        importantDates: z.array(importantDateInputSchema).optional(),
        contactReminderEnabled: z.boolean().optional(),
        contactReminderInterval: z.number().int().min(1).max(99).nullable().optional(),
        contactReminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
      },
    },
    async (input): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ person: unknown }>('POST', '/api/people', { body: input });
      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to create person.');
      }

      return jsonResult(response.data?.person ?? null);
    }
  );

  server.registerTool(
    'update_person',
    {
      title: 'Update person',
      description: 'Update fields for a person in the authenticated user\'s network.',
      inputSchema: {
        personId: z.string().describe('Person ID to update'),
        name: z.string().min(1).max(100).optional(),
        surname: z.string().max(100).nullable().optional(),
        middleName: z.string().max(100).nullable().optional(),
        secondLastName: z.string().max(100).nullable().optional(),
        nickname: z.string().max(100).nullable().optional(),
        lastContact: z.string().nullable().optional(),
        notes: z.string().max(10000).nullable().optional(),
        relationshipToUserId: z.string().nullable().optional(),
        groupIds: z.array(z.string()).optional(),
        importantDates: z.array(importantDateInputSchema).optional(),
        contactReminderEnabled: z.boolean().optional(),
        contactReminderInterval: z.number().int().min(1).max(99).nullable().optional(),
        contactReminderIntervalUnit: reminderIntervalUnitSchema.nullable().optional(),
      },
    },
    async ({ personId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ person: unknown }>('PUT', `/api/people/${personId}`, {
        body: input,
      });

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to update person.');
      }

      return jsonResult(response.data?.person ?? null);
    }
  );

  server.registerTool(
    'delete_person',
    {
      title: 'Delete person',
      description: 'Soft delete a person (and optionally their orphans).',
      inputSchema: {
        personId: z.string().describe('Person ID to delete'),
        deleteOrphans: z.boolean().optional(),
        orphanIds: z.array(z.string()).optional(),
      },
    },
    async ({ personId, deleteOrphans, orphanIds }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ message?: string; success?: boolean }>(
        'DELETE',
        `/api/people/${personId}`,
        { body: { deleteOrphans, orphanIds } }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to delete person.');
      }

      return jsonResult(response.data?.message ?? 'Person deleted successfully.');
    }
  );

  server.registerTool(
    'list_groups',
    {
      title: 'List groups',
      description: 'List groups defined for the authenticated user.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ groups: unknown[] }>('GET', '/api/groups');
      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to list groups.');
      }

      return jsonResult(response.data?.groups ?? []);
    }
  );

  server.registerTool(
    'create_group',
    {
      title: 'Create group',
      description: 'Create a new group and optionally add members.',
      inputSchema: {
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        peopleIds: z.array(z.string()).optional(),
      },
    },
    async (input): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ group: unknown }>('POST', '/api/groups', { body: input });
      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to create group.');
      }

      return jsonResult(response.data?.group ?? null);
    }
  );

  server.registerTool(
    'update_group',
    {
      title: 'Update group',
      description: 'Update a group name/description/color.',
      inputSchema: {
        groupId: z.string().describe('Group ID to update'),
        name: z.string().min(1).max(100),
        description: z.string().max(500).nullable().optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
      },
    },
    async ({ groupId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ group: unknown }>(
        'PUT',
        `/api/groups/${groupId}`,
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to update group.');
      }

      return jsonResult(response.data?.group ?? null);
    }
  );

  server.registerTool(
    'delete_group',
    {
      title: 'Delete group',
      description: 'Soft delete a group and optionally delete its members.',
      inputSchema: {
        groupId: z.string().describe('Group ID to delete'),
        deletePeople: z.boolean().optional(),
      },
    },
    async ({ groupId, deletePeople }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ message?: string; success?: boolean }>(
        'DELETE',
        `/api/groups/${groupId}`,
        { query: { deletePeople: deletePeople ?? false } }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to delete group.');
      }

      return jsonResult(response.data?.message ?? 'Group deleted successfully.');
    }
  );

  server.registerTool(
    'add_group_member',
    {
      title: 'Add group member',
      description: 'Add a person to a group.',
      inputSchema: {
        groupId: z.string().describe('Group ID'),
        personId: z.string().describe('Person ID'),
      },
    },
    async ({ groupId, personId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ success?: boolean }>(
        'POST',
        `/api/groups/${groupId}/members`,
        { body: { personId } }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to add group member.');
      }

      return jsonResult(response.data ?? { success: true });
    }
  );

  server.registerTool(
    'remove_group_member',
    {
      title: 'Remove group member',
      description: 'Remove a person from a group.',
      inputSchema: {
        groupId: z.string().describe('Group ID'),
        personId: z.string().describe('Person ID'),
      },
    },
    async ({ groupId, personId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ success?: boolean }>(
        'DELETE',
        `/api/groups/${groupId}/members/${personId}`
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to remove group member.');
      }

      return jsonResult(response.data ?? { success: true });
    }
  );

  server.registerTool(
    'list_relationship_types',
    {
      title: 'List relationship types',
      description: 'List relationship types for the authenticated user.',
      inputSchema: {},
    },
    async (): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationshipTypes: unknown[] }>(
        'GET',
        '/api/relationship-types'
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to list relationship types.');
      }

      return jsonResult(response.data?.relationshipTypes ?? []);
    }
  );

  server.registerTool(
    'list_relationships',
    {
      title: 'List relationships',
      description:
        'List person-to-person relationships (edges) with relationship type details and minimal person info.',
      inputSchema: {
        personId: z.string().optional().describe('Filter by outgoing personId.'),
        relatedPersonId: z.string().optional().describe('Filter by incoming relatedPersonId.'),
        relationshipTypeId: z.string().optional().describe('Filter by relationship type ID.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of relationships to return'),
      },
    },
    async ({ personId, relatedPersonId, relationshipTypeId, limit }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationships: unknown[] }>('GET', '/api/relationships', {
        query: { personId, relatedPersonId, relationshipTypeId, limit },
      });

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to list relationships.');
      }

      return jsonResult(response.data?.relationships ?? []);
    }
  );

  server.registerTool(
    'list_relationships_to_user',
    {
      title: 'List relationships to user',
      description:
        'List person-to-user relationship edges (relationshipToUser) with relationship type details.',
      inputSchema: {
        relationshipTypeId: z.string().optional().describe('Filter by relationship type ID.'),
        relationshipTypeName: z
          .string()
          .optional()
          .describe('Filter by relationship type name (case-insensitive).'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIST_LIMIT)
          .default(DEFAULT_LIST_LIMIT)
          .describe('Maximum number of relationships to return'),
      },
    },
    async ({ relationshipTypeId, relationshipTypeName, limit }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ people: unknown[] }>(
        'GET',
        '/api/relationships/to-user',
        { query: { relationshipTypeId, relationshipTypeName, limit } }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to list relationships to user.');
      }

      return jsonResult(response.data?.people ?? []);
    }
  );

  server.registerTool(
    'create_relationship_type',
    {
      title: 'Create relationship type',
      description: 'Create a new relationship type for the authenticated user.',
      inputSchema: {
        name: z.string().min(1).max(50),
        label: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        inverseId: z.string().nullable().optional(),
        inverseLabel: z.string().max(50).optional(),
        symmetric: z.boolean().optional(),
      },
    },
    async (input): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationshipType: unknown }>(
        'POST',
        '/api/relationship-types',
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to create relationship type.');
      }

      return jsonResult(response.data?.relationshipType ?? null);
    }
  );

  server.registerTool(
    'update_relationship_type',
    {
      title: 'Update relationship type',
      description: 'Update a relationship type for the authenticated user.',
      inputSchema: {
        relationshipTypeId: z.string().describe('Relationship type ID to update'),
        name: z.string().min(1).max(50),
        label: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        inverseId: z.string().nullable().optional(),
        inverseLabel: z.string().max(50).optional(),
        symmetric: z.boolean().optional(),
      },
    },
    async ({ relationshipTypeId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationshipType: unknown }>(
        'PUT',
        `/api/relationship-types/${relationshipTypeId}`,
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to update relationship type.');
      }

      return jsonResult(response.data?.relationshipType ?? null);
    }
  );

  server.registerTool(
    'delete_relationship_type',
    {
      title: 'Delete relationship type',
      description: 'Soft delete a relationship type for the authenticated user.',
      inputSchema: {
        relationshipTypeId: z.string().describe('Relationship type ID to delete'),
      },
    },
    async ({ relationshipTypeId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ success?: boolean }>(
        'DELETE',
        `/api/relationship-types/${relationshipTypeId}`
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to delete relationship type.');
      }

      return jsonResult(response.data ?? { success: true });
    }
  );

  server.registerTool(
    'create_relationship',
    {
      title: 'Create relationship',
      description: 'Create a new person-to-person relationship.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        relatedPersonId: z.string().describe('Related person ID'),
        relationshipTypeId: z.string().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      },
    },
    async (input): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationship: unknown }>(
        'POST',
        '/api/relationships',
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to create relationship.');
      }

      return jsonResult(response.data?.relationship ?? null);
    }
  );

  server.registerTool(
    'update_relationship',
    {
      title: 'Update relationship',
      description: 'Update a relationship type or notes.',
      inputSchema: {
        relationshipId: z.string().describe('Relationship ID to update'),
        relationshipTypeId: z.string().nullable().optional(),
        notes: z.string().max(1000).nullable().optional(),
      },
    },
    async ({ relationshipId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ relationship: unknown }>(
        'PUT',
        `/api/relationships/${relationshipId}`,
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to update relationship.');
      }

      return jsonResult(response.data?.relationship ?? null);
    }
  );

  server.registerTool(
    'delete_relationship',
    {
      title: 'Delete relationship',
      description: 'Soft delete a relationship.',
      inputSchema: {
        relationshipId: z.string().describe('Relationship ID to delete'),
      },
    },
    async ({ relationshipId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ message?: string; success?: boolean }>(
        'DELETE',
        `/api/relationships/${relationshipId}`
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to delete relationship.');
      }

      return jsonResult(response.data?.message ?? 'Relationship deleted successfully.');
    }
  );

  server.registerTool(
    'add_important_date',
    {
      title: 'Add important date',
      description: 'Add an important date to a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        title: z.string().min(1).max(100),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
        reminderEnabled: z.boolean().optional(),
        reminderType: reminderTypeSchema.nullish(),
        reminderInterval: z.number().int().min(1).max(99).nullish(),
        reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
      },
    },
    async ({ personId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ importantDate: unknown }>(
        'POST',
        `/api/people/${personId}/important-dates`,
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to add important date.');
      }

      return jsonResult(response.data?.importantDate ?? null);
    }
  );

  server.registerTool(
    'update_important_date',
    {
      title: 'Update important date',
      description: 'Update an important date for a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        dateId: z.string().describe('Important date ID'),
        title: z.string().min(1).max(100),
        date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date'),
        reminderEnabled: z.boolean().optional(),
        reminderType: reminderTypeSchema.nullish(),
        reminderInterval: z.number().int().min(1).max(99).nullish(),
        reminderIntervalUnit: reminderIntervalUnitSchema.nullish(),
      },
    },
    async ({ personId, dateId, ...input }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ importantDate: unknown }>(
        'PUT',
        `/api/people/${personId}/important-dates/${dateId}`,
        { body: input }
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to update important date.');
      }

      return jsonResult(response.data?.importantDate ?? null);
    }
  );

  server.registerTool(
    'delete_important_date',
    {
      title: 'Delete important date',
      description: 'Delete an important date for a person.',
      inputSchema: {
        personId: z.string().describe('Person ID'),
        dateId: z.string().describe('Important date ID'),
      },
    },
    async ({ personId, dateId }): Promise<ToolResult> => {
      const authError = requireAuthHeader();
      if (authError) return authError;

      const response = await apiRequest<{ message?: string; success?: boolean }>(
        'DELETE',
        `/api/people/${personId}/important-dates/${dateId}`
      );

      if (!response.ok) {
        return errorResult(response.error ?? 'Failed to delete important date.');
      }

      return jsonResult(response.data?.message ?? 'Important date deleted successfully.');
    }
  );

  server.registerResource(
    'person',
    new ResourceTemplate('nametag://people/{personId}', {
      list: async () => {
        if (!authHeader) {
          return { resources: [] };
        }

        const response = await apiRequest<{ people: Array<Record<string, unknown>> }>(
          'GET',
          '/api/people',
          { query: { orderBy: 'updatedAt', order: 'desc', limit: DEFAULT_LIST_LIMIT } }
        );

        if (!response.ok) {
          return { resources: [] };
        }

        const people = response.data?.people ?? [];

        return {
          resources: people.map((person: any) => ({
            uri: `nametag://people/${person.id}`,
            name: person.name,
            description: person.nickname ? `${person.name} (${person.nickname})` : person.name,
            mimeType: 'application/json',
          })),
        };
      },
      complete: {
        personId: async () => {
          if (!authHeader) {
            return [];
          }

          const response = await apiRequest<{ people: Array<Record<string, unknown>> }>(
            'GET',
            '/api/people',
            { query: { orderBy: 'updatedAt', order: 'desc', limit: DEFAULT_LIST_LIMIT } }
          );

          if (!response.ok) {
            return [];
          }

          const people = response.data?.people ?? [];
          return people.map((person: any) => person.id);
        },
      },
    }),
    {
      description: 'Person records from Nametag',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      if (!authHeader) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Unauthorized' }, null, 2),
            },
          ],
        };
      }

      const personId = variables.personId as string | undefined;
      if (!personId) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify({ error: 'Missing personId' }, null, 2),
            },
          ],
        };
      }

      const response = await apiRequest<{ person: unknown }>('GET', `/api/people/${personId}`);
      const payload = response.ok
        ? response.data?.person ?? { error: 'Not found' }
        : { error: response.error ?? 'Failed to fetch person.' };

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );

  return server;
}
