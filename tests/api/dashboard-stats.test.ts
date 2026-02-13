import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personCount: vi.fn(),
  groupCount: vi.fn(),
  getUpcomingEvents: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      count: mocks.personCount,
    },
    group: {
      count: mocks.groupCount,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/upcoming-events', () => ({
  getUpcomingEvents: (...args: unknown[]) => mocks.getUpcomingEvents(...args),
}));

import { GET } from '../../app/api/dashboard/stats/route';

describe('GET /api/dashboard/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return dashboard statistics', async () => {
    const mockEvents = [
      {
        id: 'important-date-1',
        personId: 'person-1',
        personName: 'Alice',
        type: 'important_date',
        title: 'Birthday',
        titleKey: null,
        date: new Date(),
        daysUntil: 5,
      },
    ];

    mocks.getUpcomingEvents.mockResolvedValue(mockEvents);
    mocks.personCount.mockResolvedValue(10);
    mocks.groupCount.mockResolvedValue(3);

    const request = new Request('http://localhost/api/dashboard/stats');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.peopleCount).toBe(10);
    expect(body.groupsCount).toBe(3);
    expect(body.upcomingEvents).toHaveLength(1);
  });

  it('should pass the user ID to getUpcomingEvents', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([]);
    mocks.personCount.mockResolvedValue(0);
    mocks.groupCount.mockResolvedValue(0);

    const request = new Request('http://localhost/api/dashboard/stats');
    await GET(request);

    expect(mocks.getUpcomingEvents).toHaveBeenCalledWith('user-123');
  });

  it('should count people and groups for the authenticated user', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([]);
    mocks.personCount.mockResolvedValue(0);
    mocks.groupCount.mockResolvedValue(0);

    const request = new Request('http://localhost/api/dashboard/stats');
    await GET(request);

    expect(mocks.personCount).toHaveBeenCalledWith({
      where: { userId: 'user-123', deletedAt: null },
    });
    expect(mocks.groupCount).toHaveBeenCalledWith({
      where: { userId: 'user-123', deletedAt: null },
    });
  });

  it('should exclude soft-deleted people from the count', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([]);
    mocks.personCount.mockResolvedValue(5);
    mocks.groupCount.mockResolvedValue(2);

    const request = new Request('http://localhost/api/dashboard/stats');
    await GET(request);

    const personCountArg = mocks.personCount.mock.calls[0][0];
    expect(personCountArg.where).toHaveProperty('deletedAt', null);
  });

  it('should exclude soft-deleted groups from the count', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([]);
    mocks.personCount.mockResolvedValue(5);
    mocks.groupCount.mockResolvedValue(2);

    const request = new Request('http://localhost/api/dashboard/stats');
    await GET(request);

    const groupCountArg = mocks.groupCount.mock.calls[0][0];
    expect(groupCountArg.where).toHaveProperty('deletedAt', null);
  });
});
