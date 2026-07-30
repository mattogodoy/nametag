import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

/**
 * Security for an endpoint reachable with either a browser session or a
 * personal API token. This is the default for authenticated endpoints: withAuth
 * accepts `Authorization: Bearer <token>` unless the route opts out.
 */
export function sessionOrToken() {
  return [{ session: [] }, { apiToken: [] }];
}

/**
 * Security for an endpoint that rejects bearer tokens, matching
 * `withAuth(handler, { allowApiToken: false })`.
 *
 * Used where a token must not be able to escalate its own reach: token
 * management, billing, and the CardDAV endpoints that read or replace stored
 * server credentials. `tests/api/openapi-coverage.test.ts` checks that this
 * stays in step with the route options.
 */
export function sessionOnly() {
  return [{ session: [] }];
}

export function pathParam(name: string, description: string) {
  return {
    name,
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
    description,
  };
}

export function jsonBody(schema: JsonSchema) {
  return {
    required: true,
    content: {
      'application/json': { schema },
    },
  };
}

/** Generates an OpenAPI requestBody from a Zod schema via z.toJSONSchema(). */
export function zodBody(schema: z.ZodType) {
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

export function jsonResponse(description: string, schema: JsonSchema) {
  return {
    description,
    content: {
      'application/json': { schema },
    },
  };
}

export function resp(description: string) {
  return {
    description,
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Error' } },
    },
  };
}

export function ref400() {
  return resp('Validation error');
}

export function ref401() {
  return resp('Unauthorized');
}

export function ref404() {
  return resp('Not found');
}

export function refMessage() {
  return {
    description: 'Success',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Message' } },
    },
  };
}

export function refSuccess() {
  return {
    description: 'Success',
    content: {
      'application/json': { schema: { $ref: '#/components/schemas/Success' } },
    },
  };
}

export function refGraph() {
  return jsonResponse('Graph data', {
    type: 'object',
    properties: {
      nodes: { type: 'array', items: { $ref: '#/components/schemas/GraphNode' } },
      edges: { type: 'array', items: { $ref: '#/components/schemas/GraphEdge' } },
    },
  });
}
