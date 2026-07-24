import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for billing limit enforcement in people and groups API routes
 */

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Prisma mocks
  personCreate: vi.fn(),
  personFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  groupCreate: vi.fn(),
  groupFindFirst: vi.fn(),
  groupFindMany: vi.fn(),
  relationshipTypeFindUnique: vi.fn(),
  relationshipCreate: vi.fn(),
  importantDateCount: vi.fn(),
  importantDateFindMany: vi.fn(),
  importantDateUpdateMany: vi.fn(),
  importantDateDeleteMany: vi.fn(),
  // Billing mocks
  canCreateResource: vi.fn(),
  canEnableReminder: vi.fn(),
  getUserUsage: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      create: mocks.personCreate,
      findUnique: mocks.personFindUnique,
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
    },
    group: {
      create: mocks.groupCreate,
      findFirst: mocks.groupFindFirst,
      findMany: mocks.groupFindMany,
    },
    relationshipType: {
      findUnique: mocks.relationshipTypeFindUnique,
    },
    relationship: {
      create: mocks.relationshipCreate,
    },
    importantDate: {
      count: mocks.importantDateCount,
      findMany: mocks.importantDateFindMany,
      updateMany: mocks.importantDateUpdateMany,
      deleteMany: mocks.importantDateDeleteMany,
    },
  },
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  canCreateResource: mocks.canCreateResource,
  canEnableReminder: mocks.canEnableReminder,
  getUserUsage: mocks.getUserUsage,
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Import after mocking
import { POST as createPerson } from '@/app/api/people/route';
import { PUT as updatePerson } from '@/app/api/people/[id]/route';
import { POST as createGroup } from '@/app/api/groups/route';

describe('Billing Limit Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importantDateFindMany.mockResolvedValue([]);
    // Default: allow resource creation
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 5,
      limit: 20,
      tier: 'FREE',
      isUnlimited: false,
    });
    mocks.canEnableReminder.mockResolvedValue({
      allowed: true,
      current: 2,
      limit: 5,
      tier: 'FREE',
      isUnlimited: false,
    });
  });

  describe('People limit enforcement', () => {
    it('should block person creation when at limit', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: false,
        current: 20,
        limit: 20,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('limit');
      expect(body.error).toContain('20');
      expect(mocks.personCreate).not.toHaveBeenCalled();
    });

    it('should allow person creation when under limit', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: true,
        current: 10,
        limit: 20,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);

      expect(response.status).toBe(201);
      expect(mocks.personCreate).toHaveBeenCalled();
    });

    it('should allow person creation with PRO unlimited tier', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: true,
        current: 10000,
        limit: Infinity,
        tier: 'PRO',
        isUnlimited: true,
      });
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);

      expect(response.status).toBe(201);
    });

    it('should check people resource type when creating person', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 20,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await createPerson(request);

      expect(mocks.canCreateResource).toHaveBeenCalledWith('user-123', 'people');
    });
  });

  describe('Reminder limit enforcement', () => {
    it('should block person with reminder when at reminder limit', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('reminder');
      expect(mocks.personCreate).not.toHaveBeenCalled();
    });

    it('should block person with important date reminders when exceeding limit', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 4,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
          importantDates: [
            { title: 'Birthday', date: '2000-01-15', reminderEnabled: true, reminderType: 'ONCE' },
            { title: 'Anniversary', date: '2020-06-20', reminderEnabled: true, reminderType: 'ONCE' },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);
      const body = await response.json();

      // 2 new reminders but only 1 slot available (5 - 4 = 1)
      expect(response.status).toBe(403);
      expect(body.error).toContain('1 more reminder');
    });

    it('should allow reminders when under limit', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 2,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);

      expect(response.status).toBe(201);
    });

    it('should allow unlimited reminders for PRO tier', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 1000,
        limit: Infinity,
        tier: 'PRO',
        isUnlimited: true,
      });
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
          importantDates: [
            { title: 'Birthday', date: '2000-01-15', reminderEnabled: true, reminderType: 'ONCE' },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);

      expect(response.status).toBe(201);
    });

    it('should not check reminder limits when no reminders enabled', async () => {
      mocks.personCreate.mockResolvedValue({
        id: 'person-new',
        name: 'New Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
          contactReminderEnabled: false,
        }),
        headers: { 'content-type': 'application/json' },
      });

      await createPerson(request);

      expect(mocks.canEnableReminder).not.toHaveBeenCalled();
    });
  });

  describe('Groups limit enforcement', () => {
    it('should block group creation when at limit', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: false,
        current: 10,
        limit: 10,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Group' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createGroup(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('limit');
      expect(body.error).toContain('10');
      expect(mocks.groupCreate).not.toHaveBeenCalled();
    });

    it('should allow group creation when under limit', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 10,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({
        id: 'group-new',
        name: 'New Group',
      });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Group' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createGroup(request);

      expect(response.status).toBe(201);
      expect(mocks.groupCreate).toHaveBeenCalled();
    });

    it('should check groups resource type when creating group', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: true,
        current: 5,
        limit: 10,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({
        id: 'group-new',
        name: 'New Group',
      });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Group' }),
        headers: { 'content-type': 'application/json' },
      });

      await createGroup(request);

      expect(mocks.canCreateResource).toHaveBeenCalledWith('user-123', 'groups');
    });

    it('should check limits before duplicate name check', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: false,
        current: 10,
        limit: 10,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Existing Group' }),
        headers: { 'content-type': 'application/json' },
      });

      await createGroup(request);

      // Should not even check for duplicates if at limit
      expect(mocks.groupFindFirst).not.toHaveBeenCalled();
    });
  });

  describe('Tier-specific limits', () => {
    it('should show PERSONAL tier limit in error message', async () => {
      mocks.canCreateResource.mockResolvedValue({
        allowed: false,
        current: 1000,
        limit: 1000,
        tier: 'PERSONAL',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createPerson(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('1000');
    });
  });

  describe('Reminder limit enforcement on person update', () => {
    beforeEach(() => {
      // Default: person exists
      mocks.personFindUnique.mockResolvedValue({
        id: 'person-1',
        name: 'Existing Person',
        userId: 'user-123',
        contactReminderEnabled: false,
      });
      mocks.importantDateCount.mockResolvedValue(0);
    });

    it('should block update when adding reminders exceeds limit', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 4,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Person',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
          importantDates: [
            { title: 'Birthday', date: '2000-01-15', reminderEnabled: true, reminderType: 'ONCE' },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await updatePerson(request, context);
      const body = await response.json();

      // Trying to add 2 reminders but only 1 slot available
      expect(response.status).toBe(403);
      expect(body.error).toContain('1 more reminder');
    });

    it('should allow update when adding reminders within limit', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 2,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.personUpdate.mockResolvedValue({
        id: 'person-1',
        name: 'Updated Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Person',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await updatePerson(request, context);

      expect(response.status).toBe(200);
      expect(mocks.personUpdate).toHaveBeenCalled();
    });

    it('should allow reducing reminders even at limit', async () => {
      // Person currently has contact reminder enabled
      mocks.personFindUnique.mockResolvedValue({
        id: 'person-1',
        name: 'Existing Person',
        userId: 'user-123',
        contactReminderEnabled: true,
      });
      mocks.importantDateCount.mockResolvedValue(2); // 2 important date reminders

      mocks.canEnableReminder.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        tier: 'FREE',
        isUnlimited: false,
      });
      mocks.personUpdate.mockResolvedValue({
        id: 'person-1',
        name: 'Updated Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Person',
          contactReminderEnabled: false, // Disabling
          importantDates: [
            { title: 'Birthday', date: '2000-01-15', reminderEnabled: true, reminderType: 'ONCE' },
            // Reducing from 2 to 1
          ],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await updatePerson(request, context);

      // Net change is negative (reducing), so should be allowed
      expect(response.status).toBe(200);
    });

    it('should not check limits when not adding new reminders', async () => {
      mocks.personUpdate.mockResolvedValue({
        id: 'person-1',
        name: 'Updated Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Person',
          contactReminderEnabled: false,
        }),
        headers: { 'content-type': 'application/json' },
      });

      const context = { params: Promise.resolve({ id: 'person-1' }) };
      await updatePerson(request, context);

      // No new reminders being added, so limit check shouldn't be called
      expect(mocks.canEnableReminder).not.toHaveBeenCalled();
    });

    it('should allow PRO tier to add unlimited reminders on update', async () => {
      mocks.canEnableReminder.mockResolvedValue({
        allowed: true,
        current: 1000,
        limit: Infinity,
        tier: 'PRO',
        isUnlimited: true,
      });
      mocks.personUpdate.mockResolvedValue({
        id: 'person-1',
        name: 'Updated Person',
        groups: [],
      });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Person',
          contactReminderEnabled: true,
          contactReminderInterval: 7,
          contactReminderIntervalUnit: 'WEEKS',
          importantDates: [
            { title: 'Birthday', date: '2000-01-15', reminderEnabled: true, reminderType: 'ONCE' },
            { title: 'Anniversary', date: '2020-06-20', reminderEnabled: true, reminderType: 'ONCE' },
          ],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await updatePerson(request, context);

      expect(response.status).toBe(200);
    });
  });
});
