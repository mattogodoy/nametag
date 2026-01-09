/**
 * Integration tests for billing flows.
 * These tests verify that billing operations work together correctly across
 * subscriptions, limits, and promotions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data store to simulate database state across operations
const mockDataStore = {
  subscriptions: new Map<string, any>(),
  promotions: new Map<string, any>(),
  userPromotions: new Map<string, any>(),
  paymentHistory: new Map<string, any>(),
  people: new Map<string, any>(),
  groups: new Map<string, any>(),
  importantDates: new Map<string, any>(),
};

// Track ID generation
let idCounter = 0;
function _generateId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

// Reset the store before each test
function resetStore() {
  mockDataStore.subscriptions.clear();
  mockDataStore.promotions.clear();
  mockDataStore.userPromotions.clear();
  mockDataStore.paymentHistory.clear();
  mockDataStore.people.clear();
  mockDataStore.groups.clear();
  mockDataStore.importantDates.clear();
  idCounter = 0;

  // Add a sample promotion
  mockDataStore.promotions.set('SAVE20', {
    id: 'promo-1',
    code: 'SAVE20',
    description: 'Save 20% for 30 days',
    discountPercent: 20,
    isActive: true,
    durationType: 'RELATIVE',
    relativeDays: 30,
    maxRedemptions: 100,
    currentRedemptions: 10,
  });
}

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Subscription operations
  subscriptionFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  subscriptionCreate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  // Person operations
  personCount: vi.fn(),
  personCreate: vi.fn(),
  personFindUnique: vi.fn(),
  // Group operations
  groupCount: vi.fn(),
  groupCreate: vi.fn(),
  groupFindFirst: vi.fn(),
  // ImportantDate operations
  importantDateCount: vi.fn(),
  // Promotion operations
  promotionFindUnique: vi.fn(),
  promotionUpdate: vi.fn(),
  // UserPromotion operations
  userPromotionFindUnique: vi.fn(),
  userPromotionCreate: vi.fn(),
  // PaymentHistory operations
  paymentHistoryCreate: vi.fn(),
  paymentHistoryFindMany: vi.fn(),
  // Transaction
  transaction: vi.fn(),
}));

// Mock Prisma with stateful implementations
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
      findFirst: mocks.subscriptionFindFirst,
      create: mocks.subscriptionCreate,
      update: mocks.subscriptionUpdate,
    },
    person: {
      count: mocks.personCount,
      create: mocks.personCreate,
      findUnique: mocks.personFindUnique,
    },
    group: {
      count: mocks.groupCount,
      create: mocks.groupCreate,
      findFirst: mocks.groupFindFirst,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    promotion: {
      findUnique: mocks.promotionFindUnique,
      update: mocks.promotionUpdate,
    },
    userPromotion: {
      findUnique: mocks.userPromotionFindUnique,
      create: mocks.userPromotionCreate,
    },
    paymentHistory: {
      create: mocks.paymentHistoryCreate,
      findMany: mocks.paymentHistoryFindMany,
    },
    $transaction: mocks.transaction,
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
    })
  ),
}));

// Mock features to enable SaaS mode for billing tests
vi.mock('@/lib/features', () => ({
  isSaasMode: () => true,
}));

// Import billing functions after mocking
import {
  getUserSubscription,
  getUserUsage,
  canCreateResource,
  createFreeSubscription,
  applyPromotion,
} from '@/lib/billing/subscription';
import { TIER_LIMITS } from '@/lib/billing/constants';

describe('Billing Integration Flows', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('New User Registration Flow', () => {
    it('should create free subscription for new users', async () => {
      const newSubscription = {
        id: 'sub-1',
        userId: 'new-user',
        tier: 'FREE',
        status: 'ACTIVE',
        billingFrequency: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        tierStartedAt: new Date(),
      };

      mocks.subscriptionCreate.mockResolvedValue(newSubscription);

      const result = await createFreeSubscription('new-user');

      expect(result.tier).toBe('FREE');
      expect(result.status).toBe('ACTIVE');
      expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'new-user',
          tier: 'FREE',
          status: 'ACTIVE',
        }),
      });
    });

    it('should give free tier limits to new users', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(0);

      const result = await canCreateResource('new-user', 'people');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(TIER_LIMITS.FREE.maxPeople);
      expect(result.tier).toBe('FREE');
    });
  });

  describe('Usage Limits Flow', () => {
    it('should track usage correctly across people and reminders', async () => {
      mocks.personCount
        .mockResolvedValueOnce(15) // Total people
        .mockResolvedValueOnce(3);  // Contact reminders
      mocks.groupCount.mockResolvedValue(5);
      mocks.importantDateCount.mockResolvedValue(2); // Date reminders

      const usage = await getUserUsage('user-123');

      expect(usage.people).toBe(15);
      expect(usage.groups).toBe(5);
      expect(usage.reminders).toBe(5); // 3 + 2
    });

    it('should block creation when free tier limit reached', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(50); // At limit

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(50);
    });

    it('should allow creation when under limit', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(10);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(50);
    });

    it('should use higher limits after upgrade to PERSONAL', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'PERSONAL',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(50);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(TIER_LIMITS.PERSONAL.maxPeople);
    });

    it('should allow unlimited for PRO tier', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'PRO',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(10000);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(true);
      expect(result.isUnlimited).toBe(true);
    });
  });

  describe('Subscription Query Flow', () => {
    it('should return subscription with promotion details', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'PERSONAL',
        status: 'ACTIVE',
        promotion: {
          id: 'up-1',
          activatedAt: new Date(),
          promotion: {
            code: 'SAVE20',
            discountPercent: 20,
          },
        },
      };

      mocks.subscriptionFindUnique.mockResolvedValue(mockSubscription);

      const result = await getUserSubscription('user-123');

      expect(result?.tier).toBe('PERSONAL');
      expect(result?.promotion?.promotion.code).toBe('SAVE20');
    });

    it('should return null for users without subscription', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue(null);

      const result = await getUserSubscription('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('Promotion Application Flow', () => {
    it('should successfully apply valid promotion', async () => {
      const promo = mockDataStore.promotions.get('SAVE20');
      mocks.promotionFindUnique.mockResolvedValue(promo);
      mocks.userPromotionFindUnique.mockResolvedValue(null); // No existing promo
      mocks.transaction.mockResolvedValue([{}, {}]);

      const result = await applyPromotion('sub-123', 'SAVE20');

      expect(result.success).toBe(true);
      expect(mocks.transaction).toHaveBeenCalled();
    });

    it('should reject invalid promotion code', async () => {
      mocks.promotionFindUnique.mockResolvedValue(null);

      const result = await applyPromotion('sub-123', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion code');
    });

    it('should reject inactive promotion', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        ...mockDataStore.promotions.get('SAVE20'),
        isActive: false,
      });

      const result = await applyPromotion('sub-123', 'SAVE20');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This promotion is no longer active');
    });

    it('should reject if user already has promotion', async () => {
      mocks.promotionFindUnique.mockResolvedValue(mockDataStore.promotions.get('SAVE20'));
      mocks.userPromotionFindUnique.mockResolvedValue({ id: 'existing' });

      const result = await applyPromotion('sub-123', 'SAVE20');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already have an active promotion');
    });

    it('should reject promotion at redemption limit', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        ...mockDataStore.promotions.get('SAVE20'),
        maxRedemptions: 100,
        currentRedemptions: 100,
      });

      const result = await applyPromotion('sub-123', 'SAVE20');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This promotion has reached its redemption limit');
    });

    it('should convert promotion code to uppercase', async () => {
      mocks.promotionFindUnique.mockResolvedValue(null);

      await applyPromotion('sub-123', 'save20');

      expect(mocks.promotionFindUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE20' },
      });
    });
  });

  describe('Cross-Resource Limit Checks', () => {
    it('should check different limits for each resource type', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });

      // Set up usage levels - canCreateResource calls personCount for 'people' and groupCount for 'groups'
      mocks.personCount.mockResolvedValue(15);
      mocks.groupCount.mockResolvedValue(8);

      const peopleCheck = await canCreateResource('user-123', 'people');

      // Reset for next call
      vi.clearAllMocks();
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.groupCount.mockResolvedValue(8);

      const groupsCheck = await canCreateResource('user-123', 'groups');

      expect(peopleCheck.limit).toBe(TIER_LIMITS.FREE.maxPeople);
      expect(groupsCheck.limit).toBe(TIER_LIMITS.FREE.maxGroups);
      expect(peopleCheck.current).toBe(15);
      expect(groupsCheck.current).toBe(8);
    });
  });

  describe('Tier Upgrade Benefits', () => {
    it('should immediately unlock higher limits after upgrade', async () => {
      // Before upgrade - at FREE limit
      mocks.subscriptionFindUnique.mockResolvedValueOnce({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount.mockResolvedValueOnce(50);

      const beforeUpgrade = await canCreateResource('user-123', 'people');
      expect(beforeUpgrade.allowed).toBe(false);

      // After upgrade to PERSONAL
      mocks.subscriptionFindUnique.mockResolvedValueOnce({
        tier: 'PERSONAL',
        promotion: null,
      });
      mocks.personCount.mockResolvedValueOnce(50);

      const afterUpgrade = await canCreateResource('user-123', 'people');
      expect(afterUpgrade.allowed).toBe(true);
      expect(afterUpgrade.limit).toBe(1000);
    });

    it('should allow unlimited resources for PRO', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'PRO',
        promotion: null,
      });

      // High usage counts
      mocks.personCount.mockResolvedValue(5000);
      mocks.groupCount.mockResolvedValue(1000);

      const [peopleCheck, groupsCheck] = await Promise.all([
        canCreateResource('user-123', 'people'),
        canCreateResource('user-123', 'groups'),
      ]);

      expect(peopleCheck.isUnlimited).toBe(true);
      expect(groupsCheck.isUnlimited).toBe(true);
    });
  });
});
