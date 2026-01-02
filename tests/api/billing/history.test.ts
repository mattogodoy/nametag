import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  subscriptionFindUnique: vi.fn(),
  paymentHistoryFindMany: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
    paymentHistory: {
      findMany: mocks.paymentHistoryFindMany,
    },
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
import { GET } from '@/app/api/billing/history/route';

describe('GET /api/billing/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return payment history', async () => {
    const mockPayments = [
      {
        id: 'pay-1',
        amount: 300,
        currency: 'usd',
        status: 'SUCCEEDED',
        description: 'Personal Plan - Monthly',
        originalAmount: 300,
        discountAmount: null,
        promotionCode: null,
        paidAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
      },
      {
        id: 'pay-2',
        amount: 240,
        currency: 'usd',
        status: 'SUCCEEDED',
        description: 'Personal Plan - Monthly',
        originalAmount: 300,
        discountAmount: 60,
        promotionCode: 'SAVE20',
        paidAt: new Date('2025-02-15'),
        createdAt: new Date('2025-02-15'),
      },
    ];

    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.paymentHistoryFindMany.mockResolvedValue(mockPayments);

    const request = new Request('http://localhost/api/billing/history');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toHaveLength(2);
    expect(body.payments[0].amount).toBe(300);
    expect(body.payments[1].promotionCode).toBe('SAVE20');
  });

  it('should return empty array if no subscription exists', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/billing/history');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual([]);
    expect(mocks.paymentHistoryFindMany).not.toHaveBeenCalled();
  });

  it('should return empty array if no payments exist', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.paymentHistoryFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/billing/history');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.payments).toEqual([]);
  });

  it('should order payments by most recent first', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.paymentHistoryFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/billing/history');
    await GET(request);

    expect(mocks.paymentHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should limit to 50 payments', async () => {
    mocks.subscriptionFindUnique.mockResolvedValue({ id: 'sub-123' });
    mocks.paymentHistoryFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/billing/history');
    await GET(request);

    expect(mocks.paymentHistoryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });
});
