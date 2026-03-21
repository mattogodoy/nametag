import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  eventCreate: vi.fn(),
  eventFindMany: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdate: vi.fn(),
  eventDelete: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
    },
    event: {
      create: mocks.eventCreate,
      findMany: mocks.eventFindMany,
      findFirst: mocks.eventFindFirst,
      update: mocks.eventUpdate,
      delete: mocks.eventDelete,
    },
  },
}));

import {
  createEvent,
  deleteEvent,
  getEvent,
  InvalidEventPeopleError,
  updateEvent,
} from '@/lib/services/event';

describe('event service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects creating an event with people outside the user scope', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'person-1' }]);

    await expect(
      createEvent('user-1', {
        title: 'Dinner',
        date: '2026-03-22T10:00:00.000Z',
        personIds: ['person-1', 'person-2'],
      })
    ).rejects.toBeInstanceOf(InvalidEventPeopleError);

    expect(mocks.eventCreate).not.toHaveBeenCalled();
  });

  it('deduplicates person ids before creating an event', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'person-1' }, { id: 'person-2' }]);
    mocks.eventCreate.mockResolvedValue({ id: 'event-1' });

    await createEvent('user-1', {
      title: 'Dinner',
      date: '2026-03-22T10:00:00.000Z',
      personIds: ['person-1', 'person-1', 'person-2'],
    });

    expect(mocks.personFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        id: { in: ['person-1', 'person-2'] },
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          people: {
            connect: [{ id: 'person-1' }, { id: 'person-2' }],
          },
        }),
      })
    );
  });

  it('uses scoped lookup when fetching a single event', async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: 'event-1' });

    await getEvent('user-1', 'event-1');

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1', userId: 'user-1' },
      })
    );
  });

  it('resets processing state when date or people change', async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: 'event-1', userId: 'user-1' });
    mocks.personFindMany.mockResolvedValue([{ id: 'person-1' }]);
    mocks.eventUpdate.mockResolvedValue({ id: 'event-1' });

    await updateEvent('user-1', 'event-1', {
      date: '2026-03-25T10:00:00.000Z',
      personIds: ['person-1'],
    });

    expect(mocks.eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1' },
        data: expect.objectContaining({
          date: new Date('2026-03-25T10:00:00.000Z'),
          lastContactProcessed: false,
          people: {
            set: [{ id: 'person-1' }],
          },
        }),
      })
    );
  });

  it('uses scoped lookup before deleting an event', async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: 'event-1', userId: 'user-1' });
    mocks.eventDelete.mockResolvedValue({ id: 'event-1' });

    await deleteEvent('user-1', 'event-1');

    expect(mocks.eventFindFirst).toHaveBeenCalledWith({ where: { id: 'event-1', userId: 'user-1' } });
    expect(mocks.eventDelete).toHaveBeenCalledWith({ where: { id: 'event-1' } });
  });
});
