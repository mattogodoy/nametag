import {
  pushSubscribeSchema,
  emailRemindersSchema,
  createEndpointSchema,
  updateEndpointSchema,
} from '../validations';
import { zodBody, jsonResponse, resp, ref400, ref401, ref404, refSuccess, pathParam, sessionOrToken } from './helpers';

// Matches the route's PUBLIC_FIELDS select exactly. `secret` is deliberately
// absent: it is write-only, encrypted at create time, and never read back out.
const notificationEndpointObject = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string', enum: ['NTFY', 'WEBHOOK'] },
    label: { type: 'string' },
    url: { type: 'string', format: 'uri' },
    enabled: { type: 'boolean' },
    consecutiveFailures: { type: 'integer' },
    lastSuccessAt: { type: ['string', 'null'], format: 'date-time' },
    lastFailureAt: { type: ['string', 'null'], format: 'date-time' },
    lastFailureCode: { type: ['string', 'null'] },
    autoDisabledAt: { type: ['string', 'null'], format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export function notificationsPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/notifications/push/public-key': {
      get: {
        tags: ['Notifications'],
        summary: 'Get the VAPID public key',
        description:
          'Returns the public key browsers need to create a push subscription. Served from ' +
          'a runtime endpoint rather than a NEXT_PUBLIC_ variable, since Nametag ships a ' +
          'prebuilt Docker image and NEXT_PUBLIC_ values are inlined at build time. ' +
          'Unauthenticated by design: the key is public by definition and the subscribe flow ' +
          'must work before session hydration completes.',
        responses: {
          '200': jsonResponse('VAPID public key', {
            type: 'object',
            properties: { publicKey: { type: 'string' } },
          }),
          '404': ref404(),
        },
      },
    },
    '/api/notifications/push/subscribe': {
      post: {
        tags: ['Notifications'],
        summary: 'Register a browser push subscription',
        description:
          'Stores a serialised browser PushSubscription for the current device. Upserts on ' +
          'endpoint, so a browser that re-subscribes updates its existing row rather than ' +
          'creating a duplicate. Capped at 20 devices per user.',
        security: sessionOrToken(),
        requestBody: zodBody(pushSubscribeSchema),
        responses: {
          '201': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '409': resp('Maximum number of devices reached'),
          '429': resp('Rate limited'),
        },
      },
    },
    '/api/notifications/push/subscriptions/{id}': {
      delete: {
        tags: ['Notifications'],
        summary: 'Revoke a push subscription',
        description:
          'Removes one device from push delivery. Scoped to the current user, so it cannot ' +
          'be used to revoke another account\'s device.',
        security: sessionOrToken(),
        parameters: [pathParam('id', 'Push subscription ID')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/notifications/email': {
      put: {
        tags: ['Notifications'],
        summary: 'Toggle email reminders',
        description: 'Enables or disables the email channel for reminder notifications.',
        security: sessionOrToken(),
        requestBody: zodBody(emailRemindersSchema),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
    '/api/notifications/endpoints': {
      get: {
        tags: ['Notifications'],
        summary: 'List notification endpoints',
        description:
          "Lists the current user's configured outbound endpoints (ntfy topics and outgoing " +
          'webhooks). Never returns the stored secret: it is write-only, encrypted at create time.',
        security: sessionOrToken(),
        responses: {
          '200': jsonResponse('Notification endpoints', {
            type: 'object',
            properties: {
              endpoints: { type: 'array', items: notificationEndpointObject },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Notifications'],
        summary: 'Create a notification endpoint',
        description:
          'Creates a new ntfy or webhook endpoint. An ntfy endpoint needs a full topic URL, ' +
          'for example https://ntfy.sh/my-topic; its optional access token is encrypted at ' +
          'rest and never returned by any endpoint. A webhook endpoint is signed with a ' +
          'server-generated HMAC-SHA256 secret, never one supplied by the client; the secret ' +
          'is returned exactly once, in this response, and cannot be read back afterwards. ' +
          'Both URL types are validated against the outbound SSRF policy before being stored. ' +
          'In SaaS mode, creating a WEBHOOK endpoint requires a Pro subscription; self-hosted ' +
          'instances have no such restriction. Capped at 5 endpoints per user, of either type.',
        security: sessionOrToken(),
        requestBody: zodBody(createEndpointSchema),
        responses: {
          '201': jsonResponse('Created endpoint', {
            type: 'object',
            properties: {
              endpoint: notificationEndpointObject,
              secret: {
                type: 'string',
                description:
                  'The webhook signing secret, 64 lowercase hex characters. Present only when ' +
                  'the request created a WEBHOOK endpoint, and only in this response: it is ' +
                  'stored encrypted and there is no endpoint that returns it again. Losing it ' +
                  'means deleting the webhook and creating a new one.',
              },
            },
            required: ['endpoint'],
          }),
          '400': jsonResponse('Invalid body or URL', {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Human-readable error message' },
              code: {
                type: 'string',
                description:
                  'Machine-readable reason, so a client can tell a permanent problem from a ' +
                  'transient one. `policy` means the URL was refused by the outbound SSRF ' +
                  'policy (wrong protocol, disallowed port, or a private address): permanent, ' +
                  'the URL must change. `dns` means the hostname did not resolve: possibly ' +
                  "transient, worth retrying as-is. `invalid` covers everything else, a body " +
                  'that failed validation, a topic URL with no topic segment, or a webhook ' +
                  'URL carrying a username or password, which is rejected rather than ' +
                  'silently stripped.',
                enum: ['policy', 'dns', 'invalid'],
              },
            },
            required: ['error', 'code'],
          }),
          '401': ref401(),
          '403': resp(
            "Two unrelated causes share this status. The Pro entitlement gate returns it, " +
              "with `code: 'forbidden'` in the body, only in SaaS mode and only for a WEBHOOK " +
              "request whose owner is not on Pro. The session-auth checks shared by every " +
              "authenticated route (invalid request origin, or a read-only API token used on " +
              "a mutating request) return the same status with no such code, for any endpoint " +
              "type, in any mode."
          ),
          '409': resp(
            'Maximum number of endpoints reached, or that URL is already registered ' +
              "(code: 'duplicate')"
          ),
          '429': resp('Rate limited'),
        },
      },
    },
    '/api/notifications/endpoints/{id}': {
      put: {
        tags: ['Notifications'],
        summary: 'Update a notification endpoint',
        description:
          'Relabels an endpoint, or enables/disables it. Re-enabling clears the auto-disable ' +
          'state and the consecutive failure counter, so a repaired endpoint gets a clean slate.',
        security: sessionOrToken(),
        parameters: [pathParam('id', 'Notification endpoint ID')],
        requestBody: zodBody(updateEndpointSchema),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Notifications'],
        summary: 'Delete a notification endpoint',
        description:
          'Permanently deletes an outbound endpoint. Scoped to the current user, so it cannot ' +
          "be used to delete another account's endpoint.",
        security: sessionOrToken(),
        parameters: [pathParam('id', 'Notification endpoint ID')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/notifications/endpoints/{id}/test': {
      post: {
        tags: ['Notifications'],
        summary: 'Send a test notification to an endpoint',
        description:
          'Sends a sample notification to one endpoint and reports the outcome immediately. ' +
          'The tightest rate limit in the app, since this is a synchronous, user-triggered ' +
          'outbound request. A failed test is reported back but never counted toward ' +
          "auto-disable, and never returns a response body or status line, only the coarse " +
          'failure category.',
        security: sessionOrToken(),
        parameters: [pathParam('id', 'Notification endpoint ID')],
        responses: {
          '200': jsonResponse('Test result', {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              code: {
                type: 'string',
                description: 'Present only when ok is false. Coarse outbound failure category.',
                enum: [
                  'blocked',
                  'dns',
                  'timeout',
                  'refused',
                  'tls',
                  'redirect',
                  'http_4xx',
                  'http_429',
                  'http_5xx',
                  'unknown',
                ],
              },
            },
          }),
          '401': ref401(),
          '403': resp(
            "Two unrelated causes share this status. The Pro entitlement gate returns it, " +
              "with `code: 'forbidden'` in the body, only in SaaS mode and only for a WEBHOOK " +
              "destination whose owner has since lost Pro access. The session-auth checks " +
              "shared by every authenticated route (invalid request origin, or a read-only " +
              "API token used on a mutating request) return the same status with no such " +
              "code, for any endpoint type, in any mode."
          ),
          '404': ref404(),
          '429': resp('Rate limited'),
        },
      },
    },
  };
}
