import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  cancelStripeSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  cancelStripeSubscription: mocks.cancelStripeSubscription,
  cancelSubscription: mocks.cancelSubscription,
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Mock features to enable SaaS mode for billing tests
vi.mock('@/lib/features', () => ({
  isSaasMode: () => true,
}));

// Import after mocking
import { POST } from '@/app/api/billing/cancel/route';

describe('POST /api/billing/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user exists with email (for email notifications)
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    });
  });

  it('should cancel subscription at period end', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      tier: 'PERSONAL',
      stripeSubscriptionId: 'sub_stripe_123',
    });
    mocks.cancelStripeSubscription.mockResolvedValue({});
    mocks.cancelSubscription.mockResolvedValue({});

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ immediately: false }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Subscription will be canceled at the end of the billing period');
    expect(mocks.cancelStripeSubscription).toHaveBeenCalledWith('sub_stripe_123', false);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith('user-123', false);
  });

  it('should cancel subscription immediately when requested', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      tier: 'PRO',
      stripeSubscriptionId: 'sub_stripe_456',
    });
    mocks.cancelStripeSubscription.mockResolvedValue({});
    mocks.cancelSubscription.mockResolvedValue({});

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ immediately: true }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Subscription canceled immediately');
    expect(mocks.cancelStripeSubscription).toHaveBeenCalledWith('sub_stripe_456', true);
    expect(mocks.cancelSubscription).toHaveBeenCalledWith('user-123', true);
  });

  it('should return 404 if no subscription exists', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Subscription not found');
  });

  it('should reject canceling free subscription', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      tier: 'FREE',
      stripeSubscriptionId: null,
    });

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Cannot cancel a free subscription');
  });

  it('should reject if no Stripe subscription exists', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      tier: 'PERSONAL',
      stripeSubscriptionId: null,
    });

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No active Stripe subscription found');
  });

  it('should default immediately to false', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({
      tier: 'PERSONAL',
      stripeSubscriptionId: 'sub_stripe_789',
    });
    mocks.cancelStripeSubscription.mockResolvedValue({});
    mocks.cancelSubscription.mockResolvedValue({});

    const request = new Request('http://localhost/api/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.cancelStripeSubscription).toHaveBeenCalledWith('sub_stripe_789', false);
  });
});
