import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  subscriptionFindFirst: vi.fn(),
  subscriptionCreate: vi.fn(),
  subscriptionUpdate: vi.fn(),
  personCount: vi.fn(),
  groupCount: vi.fn(),
  importantDateCount: vi.fn(),
  promotionFindUnique: vi.fn(),
  userPromotionFindUnique: vi.fn(),
  userPromotionCreate: vi.fn(),
  userPromotionDelete: vi.fn(),
  promotionUpdate: vi.fn(),
  transaction: vi.fn(),
}));

// Mock Prisma
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
    },
    group: {
      count: mocks.groupCount,
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
      delete: mocks.userPromotionDelete,
    },
    $transaction: mocks.transaction,
  },
}));

// Mock features to enable SaaS mode for billing tests
vi.mock('@/lib/features', () => ({
  isSaasMode: () => true,
}));

// Import after mocking
import {
  getUserSubscription,
  getUserUsage,
  canCreateResource,
  canEnableReminder,
  createFreeSubscription,
  calculatePromotionExpiry,
  isPromotionActive,
  applyPromotion,
} from '@/lib/billing/subscription';

describe('billing/subscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('should return subscription with promotion details', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        tier: 'FREE',
        status: 'ACTIVE',
        promotion: {
          id: 'up-1',
          promotion: {
            code: 'SAVE10',
            discountPercent: 10,
          },
        },
      };

      mocks.subscriptionFindUnique.mockResolvedValue(mockSubscription);

      const result = await getUserSubscription('user-123');

      expect(result).toEqual(mockSubscription);
      expect(mocks.subscriptionFindUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: {
          promotion: {
            include: {
              promotion: true,
            },
          },
        },
      });
    });

    it('should return null if no subscription exists', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue(null);

      const result = await getUserSubscription('user-123');

      expect(result).toBeNull();
    });
  });

  describe('getUserUsage', () => {
    it('should return counts for people, groups, and reminders', async () => {
      mocks.personCount
        .mockResolvedValueOnce(15) // total people
        .mockResolvedValueOnce(3); // contact reminders
      mocks.groupCount.mockResolvedValue(5);
      mocks.importantDateCount.mockResolvedValue(2); // important date reminders

      const result = await getUserUsage('user-123');

      expect(result).toEqual({
        people: 15,
        groups: 5,
        reminders: 5, // 2 + 3
      });
    });

    it('should count reminders from both ImportantDates and contact reminders', async () => {
      mocks.personCount
        .mockResolvedValueOnce(10) // total people
        .mockResolvedValueOnce(4); // contact reminders
      mocks.groupCount.mockResolvedValue(3);
      mocks.importantDateCount.mockResolvedValue(1); // important date reminders

      const result = await getUserUsage('user-123');

      expect(result.reminders).toBe(5); // 1 + 4
    });
  });

  describe('canCreateResource', () => {
    beforeEach(() => {
      // Default: no people, groups, or reminders
      mocks.personCount.mockResolvedValue(0);
      mocks.groupCount.mockResolvedValue(0);
      mocks.importantDateCount.mockResolvedValue(0);
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
      expect(result.tier).toBe('FREE');
    });

    it('should deny creation when at limit', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(50);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(50);
      expect(result.limit).toBe(50);
    });

    it('should always allow creation for PRO tier', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'PRO',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(10000);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(true);
      expect(result.isUnlimited).toBe(true);
    });

    it('should use higher limits for PERSONAL tier', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'PERSONAL',
        promotion: null,
      });
      mocks.personCount.mockResolvedValue(500);

      const result = await canCreateResource('user-123', 'people');

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000); // PERSONAL tier: 1000 people
    });

    it('should default to FREE tier if no subscription', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue(null);
      mocks.personCount.mockResolvedValue(15);

      const result = await canCreateResource('user-123', 'people');

      expect(result.tier).toBe('FREE');
      expect(result.limit).toBe(50); // Updated from 20 to 50
    });

    it('should check groups limit correctly', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.groupCount.mockResolvedValue(10);

      const result = await canCreateResource('user-123', 'groups');

      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(10);
    });
  });

  describe('canEnableReminder', () => {
    it('should check reminders limit', async () => {
      mocks.subscriptionFindUnique.mockResolvedValue({
        tier: 'FREE',
        promotion: null,
      });
      mocks.personCount
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2); // contact reminders
      mocks.groupCount.mockResolvedValue(3);
      mocks.importantDateCount.mockResolvedValue(2); // important date reminders

      const result = await canEnableReminder('user-123');

      expect(result.current).toBe(4); // 2 + 2
      expect(result.limit).toBe(5);
      expect(result.allowed).toBe(true);
    });
  });

  describe('createFreeSubscription', () => {
    it('should create a FREE tier subscription', async () => {
      const mockSubscription = {
        id: 'sub-new',
        userId: 'user-123',
        tier: 'FREE',
        status: 'ACTIVE',
      };

      mocks.subscriptionCreate.mockResolvedValue(mockSubscription);

      const result = await createFreeSubscription('user-123');

      expect(result).toEqual(mockSubscription);
      expect(mocks.subscriptionCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          tier: 'FREE',
          status: 'ACTIVE',
        }),
      });
    });
  });

  describe('calculatePromotionExpiry', () => {
    it('should return fixedEndDate for FIXED promotions', () => {
      const fixedDate = new Date('2025-12-31');
      const promotion = {
        durationType: 'FIXED' as const,
        fixedEndDate: fixedDate,
        relativeDays: null,
      };

      const result = calculatePromotionExpiry(promotion as any, new Date());

      expect(result).toEqual(fixedDate);
    });

    it('should calculate expiry for RELATIVE promotions', () => {
      const promotion = {
        durationType: 'RELATIVE' as const,
        fixedEndDate: null,
        relativeDays: 30,
      };

      const activatedAt = new Date('2025-01-01');
      const result = calculatePromotionExpiry(promotion as any, activatedAt);

      expect(result).toEqual(new Date('2025-01-31'));
    });

    it('should return null for promotions without expiry', () => {
      const promotion = {
        durationType: 'RELATIVE' as const,
        fixedEndDate: null,
        relativeDays: null,
      };

      const result = calculatePromotionExpiry(promotion as any, new Date());

      expect(result).toBeNull();
    });
  });

  describe('isPromotionActive', () => {
    it('should return false if promotion is not active', () => {
      const userPromotion = {
        activatedAt: new Date(),
        promotion: {
          isActive: false,
          durationType: 'FIXED' as const,
          fixedStartDate: null,
          fixedEndDate: null,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(false);
    });

    it('should return false if FIXED promotion has not started', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const userPromotion = {
        activatedAt: new Date(),
        promotion: {
          isActive: true,
          durationType: 'FIXED' as const,
          fixedStartDate: futureDate,
          fixedEndDate: null,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(false);
    });

    it('should return false if FIXED promotion has ended', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const userPromotion = {
        activatedAt: new Date(),
        promotion: {
          isActive: true,
          durationType: 'FIXED' as const,
          fixedStartDate: null,
          fixedEndDate: pastDate,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(false);
    });

    it('should return true for active FIXED promotion within range', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const userPromotion = {
        activatedAt: new Date(),
        promotion: {
          isActive: true,
          durationType: 'FIXED' as const,
          fixedStartDate: pastDate,
          fixedEndDate: futureDate,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(true);
    });

    it('should return false if RELATIVE promotion has expired', () => {
      const activatedAt = new Date();
      activatedAt.setDate(activatedAt.getDate() - 40);

      const userPromotion = {
        activatedAt,
        promotion: {
          isActive: true,
          durationType: 'RELATIVE' as const,
          relativeDays: 30,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(false);
    });

    it('should return true if RELATIVE promotion is still valid', () => {
      const activatedAt = new Date();
      activatedAt.setDate(activatedAt.getDate() - 10);

      const userPromotion = {
        activatedAt,
        promotion: {
          isActive: true,
          durationType: 'RELATIVE' as const,
          relativeDays: 30,
        },
      };

      const result = isPromotionActive(userPromotion as any);

      expect(result).toBe(true);
    });
  });

  describe('applyPromotion', () => {
    it('should return error for invalid code', async () => {
      mocks.promotionFindUnique.mockResolvedValue(null);

      const result = await applyPromotion('sub-123', 'INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid promotion code');
    });

    it('should return error if promotion is inactive', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        isActive: false,
      });

      const result = await applyPromotion('sub-123', 'INACTIVE');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This promotion is no longer active');
    });

    it('should return error if max redemptions reached', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        isActive: true,
        maxRedemptions: 100,
        currentRedemptions: 100,
        durationType: 'FIXED',
      });

      const result = await applyPromotion('sub-123', 'MAXED');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This promotion has reached its redemption limit');
    });

    it('should return error if subscription already has promotion', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        id: 'promo-1',
        isActive: true,
        maxRedemptions: null,
        durationType: 'RELATIVE',
        relativeDays: 30,
      });
      mocks.userPromotionFindUnique.mockResolvedValue({ id: 'existing' });

      const result = await applyPromotion('sub-123', 'VALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('You already have an active promotion');
    });

    it('should apply promotion successfully', async () => {
      mocks.promotionFindUnique.mockResolvedValue({
        id: 'promo-1',
        isActive: true,
        maxRedemptions: null,
        durationType: 'RELATIVE',
        relativeDays: 30,
      });
      mocks.userPromotionFindUnique.mockResolvedValue(null);
      mocks.transaction.mockResolvedValue([{}, {}]);

      const result = await applyPromotion('sub-123', 'VALID');

      expect(result.success).toBe(true);
      expect(mocks.transaction).toHaveBeenCalled();
    });

    it('should convert code to uppercase', async () => {
      mocks.promotionFindUnique.mockResolvedValue(null);

      await applyPromotion('sub-123', 'lowercase');

      expect(mocks.promotionFindUnique).toHaveBeenCalledWith({
        where: { code: 'LOWERCASE' },
      });
    });
  });
});
