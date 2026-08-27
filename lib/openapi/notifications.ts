import { pushSubscribeSchema, emailRemindersSchema } from '../validations';
import { zodBody, jsonResponse, ref400, ref401, ref404, refSuccess, pathParam, sessionOrToken } from './helpers';

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
          'creating a duplicate.',
        security: sessionOrToken(),
        requestBody: zodBody(pushSubscribeSchema),
        responses: {
          '201': refSuccess(),
          '400': ref400(),
          '401': ref401(),
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
  };
}
