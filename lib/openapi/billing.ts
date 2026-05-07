import { jsonBody, jsonResponse, ref400, ref401, refMessage, resp } from './helpers';

export function billingPaths(): Record<string, Record<string, unknown>> {
  return {
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
              usage: { type: 'object', description: 'Current usage counts (people, groups, reminders, customFieldTemplates)' },
              limits: { type: 'object', description: 'Plan limits for each resource (people, groups, reminders, customFieldTemplates)' },
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
              usage: { type: 'object', description: 'Current usage counts (people, groups, reminders, customFieldTemplates)' },
              limits: { type: 'object', description: 'Plan limits for each resource (people, groups, reminders, customFieldTemplates)' },
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
  };
}
