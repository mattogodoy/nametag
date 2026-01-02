import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  createBillingPortalSession: vi.fn(),
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  createBillingPortalSession: mocks.createBillingPortalSession,
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
import { POST } from '@/app/api/billing/portal/route';

describe('POST /api/billing/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create billing portal session', async () => {
    mocks.createBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/portal123',
    });

    const request = new Request('http://localhost/api/billing/portal', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe('https://billing.stripe.com/session/portal123');
    expect(mocks.createBillingPortalSession).toHaveBeenCalledWith(
      'user-123',
      expect.stringContaining('/settings/billing')
    );
  });

  it('should return error if no Stripe customer exists', async () => {
    mocks.createBillingPortalSession.mockRejectedValue(
      new Error('No Stripe customer found for this user')
    );

    const request = new Request('http://localhost/api/billing/portal', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('You need an active subscription to access the billing portal');
  });

  it('should handle other errors gracefully', async () => {
    mocks.createBillingPortalSession.mockRejectedValue(new Error('Stripe API error'));

    const request = new Request('http://localhost/api/billing/portal', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
