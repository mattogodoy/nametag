import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  stripeEventCreate: vi.fn(),
  constructWebhookEvent: vi.fn(),
  subscriptionUpdate: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  paymentHistoryCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeEvent: { create: mocks.stripeEventCreate },
    subscription: {
      update: mocks.subscriptionUpdate,
      findFirst: mocks.subscriptionFindFirst,
      findUnique: mocks.subscriptionFindUnique,
    },
    user: { update: mocks.userUpdate },
    paymentHistory: { create: mocks.paymentHistoryCreate },
  },
}));

vi.mock('@/lib/billing/stripe', () => ({
  constructWebhookEvent: mocks.constructWebhookEvent,
}));

vi.mock('@/lib/billing/emails', () => ({
  sendSubscriptionCreatedEmail: vi.fn(),
  sendSubscriptionChangedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

function makeRequest(body = 'raw-body') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': 'sig_test_123',
    },
  });
}

describe('Stripe webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('should skip processing for duplicate events (P2002)', async () => {
    const fakeEvent = {
      id: 'evt_duplicate',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          metadata: { userId: 'user-1' },
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_1' } }] },
        },
      },
    };

    mocks.constructWebhookEvent.mockReturnValue(fakeEvent);

    // Simulate unique constraint violation (duplicate event)
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
    mocks.stripeEventCreate.mockRejectedValue(p2002Error);

    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });

    // Should NOT have processed the event (no subscription update)
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.subscriptionFindFirst).not.toHaveBeenCalled();
    expect(mocks.subscriptionFindUnique).not.toHaveBeenCalled();
  });

  it('should process new events normally', async () => {
    const fakeEvent = {
      id: 'evt_new',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          metadata: { userId: 'user-1', tier: 'PERSONAL', frequency: 'MONTHLY' },
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_1' } }] },
        },
      },
    };

    mocks.constructWebhookEvent.mockReturnValue(fakeEvent);
    mocks.stripeEventCreate.mockResolvedValue({ id: 'cuid', eventId: 'evt_new' });
    mocks.subscriptionFindUnique.mockResolvedValue({ tier: 'FREE' });
    mocks.subscriptionUpdate.mockResolvedValue({});

    const response = await POST(makeRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });

    // Should have recorded the event
    expect(mocks.stripeEventCreate).toHaveBeenCalledWith({
      data: { eventId: 'evt_new' },
    });

    // Should have processed the subscription update
    expect(mocks.subscriptionUpdate).toHaveBeenCalled();
  });

  it('should re-throw non-P2002 errors from stripeEvent.create', async () => {
    const fakeEvent = {
      id: 'evt_error',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          metadata: { userId: 'user-1' },
          customer: 'cus_123',
          status: 'active',
          items: { data: [{ price: { id: 'price_1' } }] },
        },
      },
    };

    mocks.constructWebhookEvent.mockReturnValue(fakeEvent);
    mocks.stripeEventCreate.mockRejectedValue(new Error('Database connection lost'));

    // Non-P2002 errors propagate through withLogging and are re-thrown
    await expect(POST(makeRequest())).rejects.toThrow('Database connection lost');
  });
});
