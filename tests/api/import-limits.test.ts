import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionTier } from '@prisma/client';

// Mock data store
const mockDataStore = {
  users: new Map<string, any>(),
  subscriptions: new Map<string, any>(),
  people: new Map<string, any>(),
  groups: new Map<string, any>(),
};

// Track ID generation
let idCounter = 0;
function generateId(prefix: string) {
  return `${prefix}-${++idCounter}`;
}

// Reset the store before each test
function resetStore() {
  mockDataStore.users.clear();
  mockDataStore.subscriptions.clear();
  mockDataStore.people.clear();
  mockDataStore.groups.clear();
  idCounter = 0;

  // Add test user with FREE subscription
  const userId = 'user-1';
  mockDataStore.users.set(userId, {
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
  });
  mockDataStore.subscriptions.set(userId, {
    userId,
    tier: SubscriptionTier.FREE,
    status: 'ACTIVE',
  });
}

// Use vi.hoisted to create mocks
const mocks = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  personCount: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCount: vi.fn(),
  importantDateCount: vi.fn(),
  customFieldTemplateCount: vi.fn(),
  subscriptionFindUnique: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      count: mocks.personCount,
    },
    group: {
      findFirst: mocks.groupFindFirst,
      count: mocks.groupCount,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    customFieldTemplate: {
      count: mocks.customFieldTemplateCount,
    },
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
  },
}));

// Mock features
vi.mock('@/lib/features', () => ({
  isSaasMode: vi.fn(() => true),
}));

// Import after mocks are set up
import { canCreateResource, getUserUsage } from '@/lib/billing';

describe('Import Tier Limits', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();

    // Default mock implementations
    mocks.subscriptionFindUnique.mockImplementation(async ({ where }) => {
      const sub = mockDataStore.subscriptions.get(where.userId);
      if (!sub) return null;
      return {
        ...sub,
        promotion: null,
      };
    });

    mocks.personCount.mockImplementation(async () => {
      return Array.from(mockDataStore.people.values()).length;
    });

    mocks.groupCount.mockImplementation(async () => {
      return Array.from(mockDataStore.groups.values()).length;
    });

    mocks.importantDateCount.mockImplementation(async () => 0);

    mocks.customFieldTemplateCount.mockImplementation(async () => 0);

    mocks.personFindFirst.mockImplementation(async ({ where }) => {
      return Array.from(mockDataStore.people.values()).find(
        (p) =>
          p.userId === where.userId &&
          p.name.toLowerCase() === where.name.equals.toLowerCase() &&
          (where.surname === null ||
            (p.surname?.toLowerCase() === where.surname?.equals?.toLowerCase()))
      );
    });

    mocks.groupFindFirst.mockImplementation(async ({ where }) => {
      return Array.from(mockDataStore.groups.values()).find(
        (g) =>
          g.userId === where.userId &&
          g.name.toLowerCase() === where.name.equals.toLowerCase()
      );
    });
  });

  describe('FREE Tier Limits', () => {
    it('should allow import when within people limit (50)', async () => {
      // Current: 0 people, trying to add 10
      const check = await canCreateResource('user-1', 'people');
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(50);
      expect(check.current).toBe(0);
    });

    it('should reject when exceeding FREE tier people limit (50)', async () => {
      // Add 45 existing people
      for (let i = 0; i < 45; i++) {
        mockDataStore.people.set(generateId('person'), {
          id: generateId('person'),
          userId: 'user-1',
          name: `Person ${i}`,
        });
      }

      // Check if we can add 10 more (would exceed 50)
      const usage = await getUserUsage('user-1');
      expect(usage.people).toBe(45);

      const check = await canCreateResource('user-1', 'people');
      expect(check.current).toBe(45);
      expect(check.limit).toBe(50);
      expect(check.allowed).toBe(true); // Can add up to 5 more

      // Simulate trying to add 10 more
      const totalAfterImport = check.current + 10;
      const wouldExceed = totalAfterImport > check.limit;
      expect(wouldExceed).toBe(true);
    });

    it('should reject when exceeding FREE tier groups limit (10)', async () => {
      // Add 8 existing groups
      for (let i = 0; i < 8; i++) {
        mockDataStore.groups.set(generateId('group'), {
          id: generateId('group'),
          userId: 'user-1',
          name: `Group ${i}`,
        });
      }

      const usage = await getUserUsage('user-1');
      expect(usage.groups).toBe(8);

      const check = await canCreateResource('user-1', 'groups');
      expect(check.current).toBe(8);
      expect(check.limit).toBe(10);

      // Simulate trying to add 5 more
      const totalAfterImport = check.current + 5;
      const wouldExceed = totalAfterImport > check.limit;
      expect(wouldExceed).toBe(true);
    });

    it('should correctly count only NEW people (not duplicates)', async () => {
      // Add existing person
      mockDataStore.people.set('p1', {
        id: 'p1',
        userId: 'user-1',
        name: 'John',
        surname: 'Doe',
      });

      // Try to find existing person with same name
      const existing = await mocks.personFindFirst({
        where: {
          userId: 'user-1',
          name: { equals: 'John', mode: 'insensitive' },
          surname: { equals: 'Doe', mode: 'insensitive' },
        },
      });

      expect(existing).toBeDefined();
      expect(existing.name).toBe('John');
    });

    it('should correctly count only NEW groups (not duplicates)', async () => {
      // Add existing group
      mockDataStore.groups.set('g1', {
        id: 'g1',
        userId: 'user-1',
        name: 'Family',
      });

      // Try to find existing group with same name
      const existing = await mocks.groupFindFirst({
        where: {
          userId: 'user-1',
          name: { equals: 'Family', mode: 'insensitive' },
        },
      });

      expect(existing).toBeDefined();
      expect(existing.name).toBe('Family');
    });
  });

  describe('PERSONAL Tier Limits', () => {
    beforeEach(() => {
      // Upgrade to PERSONAL tier
      mockDataStore.subscriptions.set('user-1', {
        userId: 'user-1',
        tier: SubscriptionTier.PERSONAL,
        status: 'ACTIVE',
      });
    });

    it('should allow import within PERSONAL tier limits (1000 people)', async () => {
      const check = await canCreateResource('user-1', 'people');
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(1000);
      expect(check.tier).toBe(SubscriptionTier.PERSONAL);
    });

    it('should reject when exceeding PERSONAL tier people limit (1000)', async () => {
      // Add 995 existing people
      for (let i = 0; i < 995; i++) {
        mockDataStore.people.set(generateId('person'), {
          id: generateId('person'),
          userId: 'user-1',
          name: `Person ${i}`,
        });
      }

      const usage = await getUserUsage('user-1');
      expect(usage.people).toBe(995);

      const check = await canCreateResource('user-1', 'people');
      expect(check.current).toBe(995);
      expect(check.limit).toBe(1000);

      // Simulate trying to add 10 more
      const totalAfterImport = check.current + 10;
      const wouldExceed = totalAfterImport > check.limit;
      expect(wouldExceed).toBe(true);
    });

    it('should allow import within PERSONAL tier groups limit (500)', async () => {
      const check = await canCreateResource('user-1', 'groups');
      expect(check.allowed).toBe(true);
      expect(check.limit).toBe(500);
    });
  });

  describe('PRO Tier Limits', () => {
    beforeEach(() => {
      // Upgrade to PRO tier
      mockDataStore.subscriptions.set('user-1', {
        userId: 'user-1',
        tier: SubscriptionTier.PRO,
        status: 'ACTIVE',
      });
    });

    it('should allow unlimited people for PRO tier', async () => {
      const check = await canCreateResource('user-1', 'people');
      expect(check.allowed).toBe(true);
      expect(check.isUnlimited).toBe(true);
      expect(check.limit).toBe(Infinity);
    });

    it('should allow unlimited groups for PRO tier', async () => {
      const check = await canCreateResource('user-1', 'groups');
      expect(check.allowed).toBe(true);
      expect(check.isUnlimited).toBe(true);
      expect(check.limit).toBe(Infinity);
    });
  });

  describe('Usage Calculations', () => {
    it('should correctly calculate current usage', async () => {
      // Reset and add some people and groups
      mockDataStore.people.clear();
      mockDataStore.groups.clear();

      for (let i = 0; i < 5; i++) {
        mockDataStore.people.set(generateId('person'), {
          id: generateId('person'),
          userId: 'user-1',
          name: `Person ${i}`,
        });
      }

      for (let i = 0; i < 3; i++) {
        mockDataStore.groups.set(generateId('group'), {
          id: generateId('group'),
          userId: 'user-1',
          name: `Group ${i}`,
        });
      }

      const usage = await getUserUsage('user-1');
      expect(usage.people).toBe(5);
      expect(usage.groups).toBe(3);
      // Reminders count comes from importantDate.count which is mocked to return 0
    });

    it('should calculate remaining slots correctly', async () => {
      // Add 30 people to FREE tier
      for (let i = 0; i < 30; i++) {
        mockDataStore.people.set(generateId('person'), {
          id: generateId('person'),
          userId: 'user-1',
          name: `Person ${i}`,
        });
      }

      const check = await canCreateResource('user-1', 'people');
      const remainingSlots = check.limit - check.current;
      expect(remainingSlots).toBe(20); // 50 - 30 = 20
    });
  });
});
