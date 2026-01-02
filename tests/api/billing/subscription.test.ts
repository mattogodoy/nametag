import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  getSubscriptionWithStatus: vi.fn(),
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  getSubscriptionWithStatus: mocks.getSubscriptionWithStatus,
  TIER_INFO: {
    FREE: { name: 'Free', description: 'Basic', monthlyPrice: null, yearlyPrice: null, features: [] },
    PERSONAL: { name: 'Personal', description: 'Better', monthlyPrice: 3, yearlyPrice: 30, features: [] },
    PRO: { name: 'Pro', description: 'Best', monthlyPrice: 5, yearlyPrice: 50, features: [] },
  },
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
import { GET } from '@/app/api/billing/subscription/route';

describe('GET /api/billing/subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return subscription status for authenticated user', async () => {
    const mockSubscriptionData = {
      subscription: {
        id: 'sub-1',
        tier: 'FREE',
        status: 'ACTIVE',
        billingFrequency: null,
        tierStartedAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        promotion: null,
      },
      promotionActive: false,
      promotionExpiry: null,
      usage: { people: 5, groups: 2, reminders: 1 },
      limits: {
        people: { current: 5, limit: 50, isUnlimited: false },
        groups: { current: 2, limit: 10, isUnlimited: false },
        reminders: { current: 1, limit: 5, isUnlimited: false },
      },
    };

    mocks.getSubscriptionWithStatus.mockResolvedValue(mockSubscriptionData);

    const request = new Request('http://localhost/api/billing/subscription');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subscription).toBeDefined();
    expect(body.tierInfo).toBeDefined();
    expect(body.usage).toEqual({ people: 5, groups: 2, reminders: 1 });
    expect(body.limits).toBeDefined();
  });

  it('should include promotion details when present', async () => {
    const mockSubscriptionData = {
      subscription: {
        id: 'sub-1',
        tier: 'PERSONAL',
        status: 'ACTIVE',
        billingFrequency: 'MONTHLY',
        tierStartedAt: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        promotion: {
          promotion: {
            code: 'SAVE20',
            description: 'Save 20%',
            discountPercent: 20,
          },
        },
      },
      promotionActive: true,
      promotionExpiry: new Date('2025-12-31'),
      usage: { people: 50, groups: 10, reminders: 5 },
      limits: {
        people: { current: 50, limit: 1000, isUnlimited: false },
        groups: { current: 10, limit: 500, isUnlimited: false },
        reminders: { current: 5, limit: 100, isUnlimited: false },
      },
    };

    mocks.getSubscriptionWithStatus.mockResolvedValue(mockSubscriptionData);

    const request = new Request('http://localhost/api/billing/subscription');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.promotion).toBeDefined();
    expect(body.promotion.code).toBe('SAVE20');
    expect(body.promotion.discountPercent).toBe(20);
    expect(body.promotion.isActive).toBe(true);
  });

  it('should handle users without subscription', async () => {
    mocks.getSubscriptionWithStatus.mockResolvedValue({
      subscription: null,
      promotionActive: false,
      promotionExpiry: null,
      usage: { people: 0, groups: 0, reminders: 0 },
      limits: {
        people: { current: 0, limit: 50, isUnlimited: false },
        groups: { current: 0, limit: 10, isUnlimited: false },
        reminders: { current: 0, limit: 5, isUnlimited: false },
      },
    });

    const request = new Request('http://localhost/api/billing/subscription');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subscription).toBeNull();
    expect(body.tierInfo.name).toBe('Free');
  });
});
