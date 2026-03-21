import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createEventSchema, updateEventSchema } from '@/lib/validations';

export type EventInput = z.infer<typeof createEventSchema>;
export type EventUpdateInput = z.infer<typeof updateEventSchema>;

export class InvalidEventPeopleError extends Error {
  constructor() {
    super('One or more selected people are invalid');
    this.name = 'InvalidEventPeopleError';
  }
}

const eventInclude = {
  people: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      surname: true,
      nickname: true,
      photo: true,
    },
  },
} as const;

function getUniquePersonIds(personIds: string[]): string[] {
  return [...new Set(personIds)];
}

async function assertOwnedPeople(userId: string, personIds: string[]) {
  const uniquePersonIds = getUniquePersonIds(personIds);
  const ownedPeople = await prisma.person.findMany({
    where: {
      userId,
      id: { in: uniquePersonIds },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (ownedPeople.length !== uniquePersonIds.length) {
    throw new InvalidEventPeopleError();
  }

  return uniquePersonIds;
}

export async function createEvent(userId: string, data: EventInput) {
  const personIds = await assertOwnedPeople(userId, data.personIds);

  return prisma.event.create({
    data: {
      userId,
      title: data.title,
      date: new Date(data.date),
      people: {
        connect: personIds.map((id) => ({ id })),
      },
    },
    include: eventInclude,
  });
}

export async function getEvents(userId: string) {
  return prisma.event.findMany({
    where: { userId },
    include: eventInclude,
    orderBy: { date: 'asc' },
  });
}

export async function getEventsForPerson(userId: string, personId: string) {
  return prisma.event.findMany({
    where: {
      userId,
      people: { some: { id: personId } },
    },
    include: eventInclude,
    orderBy: { date: 'asc' },
  });
}

export async function getEvent(userId: string, id: string) {
  return prisma.event.findFirst({
    where: { id, userId },
    include: eventInclude,
  });
}

export async function updateEvent(userId: string, id: string, data: EventUpdateInput) {
  // Verify ownership
  const existing = await prisma.event.findFirst({ where: { id, userId } });
  if (!existing) return null;

  const personIds = data.personIds !== undefined
    ? await assertOwnedPeople(userId, data.personIds)
    : undefined;

  const shouldReprocess =
    data.date !== undefined ||
    personIds !== undefined;

  return prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.date !== undefined && { date: new Date(data.date) }),
      ...(personIds !== undefined && {
        people: {
          set: personIds.map((pid) => ({ id: pid })),
        },
      }),
      ...(shouldReprocess && { lastContactProcessed: false }),
    },
    include: eventInclude,
  });
}

export async function deleteEvent(userId: string, id: string) {
  const existing = await prisma.event.findFirst({ where: { id, userId } });
  if (!existing) return null;
  return prisma.event.delete({ where: { id } });
}
