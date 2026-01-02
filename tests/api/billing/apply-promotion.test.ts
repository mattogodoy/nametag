import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  applyPromotion: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
  },
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  applyPromotion: mocks.applyPromotion,
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
import { POST } from '@/app/api/billing/apply-promotion/route';

describe('POST /api/billing/apply-promotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should apply valid promotion code', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.applyPromotion.mockResolvedValue({ success: true });

    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Promotion applied successfully');
    expect(mocks.applyPromotion).toHaveBeenCalledWith('sub-123', 'SAVE20');
  });

  it('should return error for invalid promotion code', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.applyPromotion.mockResolvedValue({
      success: false,
      error: 'Invalid promotion code',
    });

    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: 'INVALID' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid promotion code');
  });

  it('should return 404 if no subscription exists', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Subscription not found');
  });

  it('should require code field', async () => {
    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('should reject empty code', async () => {
    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: '' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('should handle already has promotion error', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.applyPromotion.mockResolvedValue({
      success: false,
      error: 'You already have an active promotion',
    });

    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('You already have an active promotion');
  });

  it('should handle expired promotion error', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.applyPromotion.mockResolvedValue({
      success: false,
      error: 'This promotion has expired',
    });

    const request = new Request('http://localhost/api/billing/apply-promotion', {
      method: 'POST',
      body: JSON.stringify({ code: 'EXPIRED' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('This promotion has expired');
  });
});
