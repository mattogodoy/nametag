import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  importantDateFindMany: vi.fn(),
  importantDateCreate: vi.fn(),
  canEnableReminder: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
    },
    importantDate: {
      findMany: mocks.importantDateFindMany,
      create: mocks.importantDateCreate,
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

vi.mock('../../lib/billing', () => ({
  canEnableReminder: (...args: unknown[]) => mocks.canEnableReminder(...args),
}));

import { GET, POST } from '../../app/api/people/[id]/important-dates/route';

describe('Important Dates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/people/[id]/important-dates', () => {
    it('should return important dates for a person', async () => {
      const mockPerson = { id: 'person-1', userId: 'user-123', name: 'Alice' };
      const mockDates = [
        { id: 'date-1', personId: 'person-1', title: 'Birthday', date: new Date('2025-06-15') },
        { id: 'date-2', personId: 'person-1', title: 'Anniversary', date: new Date('2025-12-01') },
      ];

      mocks.personFindUnique.mockResolvedValue(mockPerson);
      mocks.importantDateFindMany.mockResolvedValue(mockDates);

      const request = new Request('http://localhost/api/people/person-1/important-dates');
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.importantDates).toHaveLength(2);
    });

    it('should check person ownership', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/person-1/important-dates');
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      await GET(request, context);

      expect(mocks.personFindUnique).toHaveBeenCalledWith({
        where: { id: 'person-1', userId: 'user-123' },
      });
    });

    it('should return 404 if person not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent/important-dates');
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should order dates ascending', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1', userId: 'user-123' });
      mocks.importantDateFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people/person-1/important-dates');
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      await GET(request, context);

      expect(mocks.importantDateFindMany).toHaveBeenCalledWith({
        where: { personId: 'person-1' },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('POST /api/people/[id]/important-dates', () => {
    it('should create an important date', async () => {
      const mockPerson = { id: 'person-1', userId: 'user-123', name: 'Alice' };
      const mockCreated = {
        id: 'date-new',
        personId: 'person-1',
        title: 'Birthday',
        date: new Date('2025-06-15'),
        reminderEnabled: false,
      };

      mocks.personFindUnique.mockResolvedValue(mockPerson);
      mocks.importantDateCreate.mockResolvedValue(mockCreated);

      const request = new Request('http://localhost/api/people/person-1/important-dates', {
        method: 'POST',
        body: JSON.stringify({ title: 'Birthday', date: '2025-06-15' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      const response = await POST(request, context);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.importantDate.title).toBe('Birthday');
    });

    it('should return 404 if person not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent/important-dates', {
        method: 'POST',
        body: JSON.stringify({ title: 'Birthday', date: '2025-06-15' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await POST(request, context);

      expect(response.status).toBe(404);
    });

    it('should validate request body', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1', userId: 'user-123' });

      const request = new Request('http://localhost/api/people/person-1/important-dates', {
        method: 'POST',
        body: JSON.stringify({ date: '2025-06-15' }), // missing title
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      const response = await POST(request, context);

      expect(response.status).toBe(400);
    });

    it('should check reminder limits when enabling a reminder', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1', userId: 'user-123' });
      mocks.canEnableReminder.mockResolvedValue({ isUnlimited: false, limit: 2, current: 2 });

      const request = new Request('http://localhost/api/people/person-1/important-dates', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Birthday',
          date: '2025-06-15',
          reminderEnabled: true,
          reminderType: 'RECURRING',
          reminderInterval: 1,
          reminderIntervalUnit: 'YEARS',
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      const response = await POST(request, context);

      expect(response.status).toBe(403);
    });

    it('should allow creation with reminder when under limit', async () => {
      mocks.personFindUnique.mockResolvedValue({ id: 'person-1', userId: 'user-123' });
      mocks.canEnableReminder.mockResolvedValue({ isUnlimited: false, limit: 5, current: 2 });
      mocks.importantDateCreate.mockResolvedValue({
        id: 'date-new',
        personId: 'person-1',
        title: 'Birthday',
        date: new Date('2025-06-15'),
        reminderEnabled: true,
        reminderType: 'RECURRING',
        reminderInterval: 1,
        reminderIntervalUnit: 'YEARS',
      });

      const request = new Request('http://localhost/api/people/person-1/important-dates', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Birthday',
          date: '2025-06-15',
          reminderEnabled: true,
          reminderType: 'RECURRING',
          reminderInterval: 1,
          reminderIntervalUnit: 'YEARS',
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };

      const response = await POST(request, context);

      expect(response.status).toBe(201);
    });
  });
});
