import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  userPromotionFindFirst: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userPromotion: {
      findFirst: mocks.userPromotionFindFirst,
    },
  },
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  createCheckoutSession: mocks.createCheckoutSession,
  isPromotionActive: vi.fn(() => false), // Default: no active promotion
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

// Import after mocking
import { POST } from '@/app/api/billing/checkout/route';

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no user promotion
    mocks.userPromotionFindFirst.mockResolvedValue(null);
  });

  it('should create checkout session for PERSONAL tier monthly', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session123',
    });

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'PERSONAL', frequency: 'MONTHLY' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/session123');
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      'user-123',
      'test@example.com',
      'Test User',
      'PERSONAL',
      'MONTHLY',
      expect.stringContaining('/settings/billing?success=true'),
      expect.stringContaining('/settings/billing?canceled=true'),
      undefined
    );
  });

  it('should create checkout session for PRO tier yearly', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session456',
    });

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'PRO', frequency: 'YEARLY' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      'user-123',
      'test@example.com',
      'Test User',
      'PRO',
      'YEARLY',
      expect.any(String),
      expect.any(String),
      undefined
    );
  });

  it('should pass promotion code when provided', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session789',
    });

    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({
        tier: 'PERSONAL',
        frequency: 'YEARLY',
        promotionCode: 'SAVE20',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith(
      'user-123',
      'test@example.com',
      'Test User',
      'PERSONAL',
      'YEARLY',
      expect.any(String),
      expect.any(String),
      'SAVE20'
    );
  });

  it('should reject invalid tier', async () => {
    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'INVALID', frequency: 'MONTHLY' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('should reject FREE tier (cannot upgrade to free)', async () => {
    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'FREE', frequency: 'MONTHLY' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('should reject invalid frequency', async () => {
    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'PERSONAL', frequency: 'WEEKLY' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('should require tier and frequency', async () => {
    const request = new Request('http://localhost/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });
});
