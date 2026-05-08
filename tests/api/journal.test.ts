import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  journalEntryFindMany: vi.fn(),
  journalEntryCreate: vi.fn(),
  journalEntryCount: vi.fn(),
  journalEntryFindUnique: vi.fn(),
  journalEntryUpdate: vi.fn(),
  journalEntryPersonDeleteMany: vi.fn(),
  personUpdateMany: vi.fn(),
  personFindMany: vi.fn(),
  personCount: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    journalEntry: {
      findMany: mocks.journalEntryFindMany,
      create: mocks.journalEntryCreate,
      count: mocks.journalEntryCount,
      findUnique: mocks.journalEntryFindUnique,
      update: mocks.journalEntryUpdate,
    },
    journalEntryPerson: {
      deleteMany: mocks.journalEntryPersonDeleteMany,
    },
    person: {
      updateMany: mocks.personUpdateMany,
      findMany: mocks.personFindMany,
      count: mocks.personCount,
    },
    $transaction: mocks.$transaction,
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
  canCreateResource: vi.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 100, tier: 'FREE', isUnlimited: false })),
  canEnableReminder: vi.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 5, isUnlimited: false })),
  getUserUsage: vi.fn(() => Promise.resolve({ people: 0, groups: 0, reminders: 0 })),
}));

import { GET, POST } from '../../app/api/journal/route';
import { GET as GET_DETAIL, PUT, DELETE } from '../../app/api/journal/[id]/route';

describe('Journal API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/journal', () => {
    it('should return list of journal entries for authenticated user', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          title: 'Coffee with Tom',
          date: new Date('2026-03-28'),
          body: 'Had coffee at the usual spot.',
          people: [],
        },
      ];
      mocks.journalEntryFindMany.mockResolvedValue(mockEntries);
      mocks.journalEntryCount.mockResolvedValue(1);

      const request = new Request('http://localhost/api/journal');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'entry-1', title: 'Coffee with Tom' }),
      ]));
    });

    it('should filter by person when ?person=id is provided', async () => {
      mocks.journalEntryFindMany.mockResolvedValue([]);
      mocks.journalEntryCount.mockResolvedValue(0);

      const request = new Request('http://localhost/api/journal?person=person-1');
      await GET(request);

      expect(mocks.journalEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            people: { some: { personId: 'person-1' } },
          }),
        })
      );
    });

    it('should filter soft-deleted entries', async () => {
      mocks.journalEntryFindMany.mockResolvedValue([]);
      mocks.journalEntryCount.mockResolvedValue(0);

      const request = new Request('http://localhost/api/journal');
      await GET(request);

      expect(mocks.journalEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('POST /api/journal', () => {
    it('should create a journal entry', async () => {
      const mockEntry = {
        id: 'entry-1',
        title: 'Dinner with friends',
        date: new Date('2026-03-28'),
        body: 'Great evening.',
        people: [],
      };
      mocks.journalEntryCreate.mockResolvedValue(mockEntry);

      const request = new Request('http://localhost/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Dinner with friends',
          date: '2026-03-28',
          body: 'Great evening.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.entry).toEqual(expect.objectContaining({ title: 'Dinner with friends' }));
    });

    it('should persist hasTime=true and the supplied UTC instant', async () => {
      mocks.journalEntryCreate.mockResolvedValue({
        id: 'entry-2',
        title: 'Quick call with Maria',
        date: new Date('2026-05-07T22:30:00.000Z'),
        hasTime: true,
        body: 'Caught up briefly.',
        people: [],
      });

      const request = new Request('http://localhost/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Quick call with Maria',
          date: '2026-05-07T22:30:00.000Z',
          hasTime: true,
          body: 'Caught up briefly.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const callArg = mocks.journalEntryCreate.mock.calls[0][0];
      expect(callArg.data.hasTime).toBe(true);
      expect(callArg.data.date).toEqual(new Date('2026-05-07T22:30:00.000Z'));
    });

    it('should persist hasTime=false and midnight UTC for date-only entries', async () => {
      mocks.journalEntryCreate.mockResolvedValue({
        id: 'entry-3',
        title: 'Birthday',
        date: new Date('2026-03-28T00:00:00.000Z'),
        hasTime: false,
        body: 'Family lunch.',
        people: [],
      });

      const request = new Request('http://localhost/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Birthday',
          date: '2026-03-28',
          body: 'Family lunch.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const callArg = mocks.journalEntryCreate.mock.calls[0][0];
      expect(callArg.data.hasTime).toBe(false);
      expect(callArg.data.date).toEqual(new Date('2026-03-28T00:00:00.000Z'));
    });

    it('should return 400 for missing title', async () => {
      const request = new Request('http://localhost/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-03-28',
          body: 'Some text.',
        }),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});

describe('Journal Detail API', () => {
  const mockContext = { params: Promise.resolve({ id: 'entry-1' }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/journal/[id]', () => {
    it('should return a journal entry by id', async () => {
      const mockEntry = {
        id: 'entry-1',
        userId: 'user-123',
        title: 'Coffee with Tom',
        date: new Date('2026-03-28'),
        body: 'Had coffee.',
        people: [],
      };
      mocks.journalEntryFindUnique.mockResolvedValue(mockEntry);

      const request = new Request('http://localhost/api/journal/entry-1');
      const response = await GET_DETAIL(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry.title).toBe('Coffee with Tom');
    });

    it('should return 404 for non-existent entry', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/journal/nonexistent');
      const response = await GET_DETAIL(request, mockContext);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/journal/[id]', () => {
    it('should update a journal entry', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue({
        id: 'entry-1',
        userId: 'user-123',
      });
      const updatedEntry = {
        id: 'entry-1',
        title: 'Updated title',
        date: new Date('2026-03-28'),
        body: 'Updated body.',
        people: [],
      };
      mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn({
          journalEntryPerson: { deleteMany: mocks.journalEntryPersonDeleteMany },
          journalEntry: { update: mocks.journalEntryUpdate },
        });
      });
      mocks.journalEntryPersonDeleteMany.mockResolvedValue({ count: 0 });
      mocks.journalEntryUpdate.mockResolvedValue(updatedEntry);

      const request = new Request('http://localhost/api/journal/entry-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated title',
          date: '2026-03-28',
          body: 'Updated body.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await PUT(request, mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entry.title).toBe('Updated title');
    });

    it('should return 404 for non-existent entry', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/journal/entry-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated',
          date: '2026-03-28',
          body: 'Updated.',
        }),
      });
      const response = await PUT(request, mockContext);

      expect(response.status).toBe(404);
    });

    it('should persist hasTime=true and UTC instant when toggled on', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue({
        id: 'entry-1',
        userId: 'user-123',
        title: 'Old title',
        date: new Date('2026-05-07T00:00:00.000Z'),
        hasTime: false,
        body: 'Old body.',
        deletedAt: null,
      });
      const updatedEntry = {
        id: 'entry-1',
        title: 'Coffee',
        date: new Date('2026-05-07T22:30:00.000Z'),
        hasTime: true,
        body: 'New body.',
        people: [],
      };
      mocks.$transaction.mockImplementation(async (cb: (tx: typeof mocks) => unknown) => {
        mocks.journalEntryUpdate.mockResolvedValue(updatedEntry);
        return cb({
          journalEntryPerson: { deleteMany: mocks.journalEntryPersonDeleteMany },
          journalEntry: { update: mocks.journalEntryUpdate },
        } as unknown as typeof mocks);
      });

      const request = new Request('http://localhost/api/journal/entry-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Coffee',
          date: '2026-05-07T22:30:00.000Z',
          hasTime: true,
          body: 'New body.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'entry-1' }) });

      expect(response.status).toBe(200);
      const callArg = mocks.journalEntryUpdate.mock.calls[0][0];
      expect(callArg.data.hasTime).toBe(true);
      expect(callArg.data.date).toEqual(new Date('2026-05-07T22:30:00.000Z'));
    });

    it('should persist hasTime=false and midnight UTC when toggled off', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue({
        id: 'entry-1',
        userId: 'user-123',
        title: 'Old title',
        date: new Date('2026-05-07T22:30:00.000Z'),
        hasTime: true,
        body: 'Old body.',
        deletedAt: null,
      });
      const updatedEntry = {
        id: 'entry-1',
        title: 'Coffee',
        date: new Date('2026-05-07T00:00:00.000Z'),
        hasTime: false,
        body: 'New body.',
        people: [],
      };
      mocks.$transaction.mockImplementation(async (cb: (tx: typeof mocks) => unknown) => {
        mocks.journalEntryUpdate.mockResolvedValue(updatedEntry);
        return cb({
          journalEntryPerson: { deleteMany: mocks.journalEntryPersonDeleteMany },
          journalEntry: { update: mocks.journalEntryUpdate },
        } as unknown as typeof mocks);
      });

      const request = new Request('http://localhost/api/journal/entry-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Coffee',
          date: '2026-05-07',
          hasTime: false,
          body: 'New body.',
          personIds: [],
          updateLastContact: false,
        }),
      });
      const response = await PUT(request, { params: Promise.resolve({ id: 'entry-1' }) });

      expect(response.status).toBe(200);
      const callArg = mocks.journalEntryUpdate.mock.calls[0][0];
      expect(callArg.data.hasTime).toBe(false);
      expect(callArg.data.date).toEqual(new Date('2026-05-07T00:00:00.000Z'));
    });
  });

  describe('DELETE /api/journal/[id]', () => {
    it('should soft-delete a journal entry', async () => {
      mocks.journalEntryFindUnique.mockResolvedValue({
        id: 'entry-1',
        userId: 'user-123',
      });
      mocks.journalEntryUpdate.mockResolvedValue({});

      const request = new Request('http://localhost/api/journal/entry-1', {
        method: 'DELETE',
      });
      const response = await DELETE(request, mockContext);

      expect(response.status).toBe(200);
      expect(mocks.journalEntryUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });
  });
});
