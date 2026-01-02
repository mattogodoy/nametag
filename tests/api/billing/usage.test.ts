import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  getSubscriptionWithStatus: vi.fn(),
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  getSubscriptionWithStatus: mocks.getSubscriptionWithStatus,
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
import { GET } from '@/app/api/billing/usage/route';

describe('GET /api/billing/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return usage and limits for FREE tier', async () => {
    mocks.getSubscriptionWithStatus.mockResolvedValue({
      subscription: { tier: 'FREE' },
      usage: { people: 10, groups: 5, reminders: 3 },
      limits: {
        people: { current: 10, limit: 50, isUnlimited: false },
        groups: { current: 5, limit: 10, isUnlimited: false },
        reminders: { current: 3, limit: 5, isUnlimited: false },
      },
    });

    const request = new Request('http://localhost/api/billing/usage');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tier).toBe('FREE');
    expect(body.usage).toEqual({ people: 10, groups: 5, reminders: 3 });
    expect(body.limits.people.limit).toBe(50);
  });

  it('should return unlimited for PRO tier', async () => {
    mocks.getSubscriptionWithStatus.mockResolvedValue({
      subscription: { tier: 'PRO' },
      usage: { people: 500, groups: 100, reminders: 50 },
      limits: {
        people: { current: 500, limit: Infinity, isUnlimited: true },
        groups: { current: 100, limit: Infinity, isUnlimited: true },
        reminders: { current: 50, limit: Infinity, isUnlimited: true },
      },
    });

    const request = new Request('http://localhost/api/billing/usage');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tier).toBe('PRO');
    expect(body.limits.people.isUnlimited).toBe(true);
    expect(body.limits.groups.isUnlimited).toBe(true);
    expect(body.limits.reminders.isUnlimited).toBe(true);
  });

  it('should default to FREE tier when no subscription', async () => {
    mocks.getSubscriptionWithStatus.mockResolvedValue({
      subscription: null,
      usage: { people: 0, groups: 0, reminders: 0 },
      limits: {
        people: { current: 0, limit: 50, isUnlimited: false },
        groups: { current: 0, limit: 10, isUnlimited: false },
        reminders: { current: 0, limit: 5, isUnlimited: false },
      },
    });

    const request = new Request('http://localhost/api/billing/usage');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tier).toBe('FREE');
  });
});
