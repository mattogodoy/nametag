import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { parseAsLocalDate } from '@/lib/date-format';

export interface UpcomingEvent {
  id: string;
  personId: string;
  personName: string;
  type: 'important_date' | 'contact_reminder';
  title: string | null;
  titleKey: 'timeToCatchUp' | null;
  date: Date;
  daysUntil: number;
}

export function getNextOccurrence(
  eventDate: Date,
  today: Date,
  interval: number,
  intervalUnit: string,
  lastReminderSent: Date | null
): Date {
  const eventDateNormalized = new Date(eventDate);
  eventDateNormalized.setHours(0, 0, 0, 0);

  const todayNormalized = new Date(today);
  todayNormalized.setHours(0, 0, 0, 0);

  // Special handling for YEARS to get the next anniversary
  if (intervalUnit === 'YEARS') {
    const thisYearOccurrence = new Date(
      today.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    );
    thisYearOccurrence.setHours(0, 0, 0, 0);

    if (thisYearOccurrence.getTime() >= todayNormalized.getTime()) {
      return thisYearOccurrence;
    }

    return new Date(
      today.getFullYear() + 1,
      eventDate.getMonth(),
      eventDate.getDate()
    );
  }

  // For other intervals (DAYS, WEEKS, MONTHS), calculate from event date or last sent
  const intervalMs = getIntervalMs(interval, intervalUnit);
  const referenceDate = lastReminderSent
    ? new Date(lastReminderSent)
    : eventDateNormalized;
  referenceDate.setHours(0, 0, 0, 0);

  // If reference date is in the future, return it
  if (referenceDate.getTime() > todayNormalized.getTime()) {
    return referenceDate;
  }

  // Calculate how many intervals have passed since reference date
  const timeSinceReference = todayNormalized.getTime() - referenceDate.getTime();
  const intervalsPassed = Math.floor(timeSinceReference / intervalMs);

  // Calculate next occurrence (add one more interval to get the next one)
  const nextOccurrence = new Date(referenceDate.getTime() + ((intervalsPassed + 1) * intervalMs));
  nextOccurrence.setHours(0, 0, 0, 0);

  return nextOccurrence;
}

export function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  switch (unit) {
    case 'DAYS':
      return interval * msPerDay;
    case 'WEEKS':
      return interval * 7 * msPerDay;
    case 'MONTHS':
      return interval * 30 * msPerDay;
    case 'YEARS':
      return interval * 365 * msPerDay;
    default:
      return 30 * msPerDay;
  }
}

export function getDaysUntil(date: Date, today: Date): number {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const todayNormalized = new Date(today);
  todayNormalized.setHours(0, 0, 0, 0);
  return Math.round((targetDate.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getUpcomingEvents(userId: string): Promise<UpcomingEvent[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [importantDates, peopleWithContactReminders] = await Promise.all([
    prisma.importantDate.findMany({
      where: {
        person: { userId, deletedAt: null },
        reminderEnabled: true,
        deletedAt: null,
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            surname: true,
            nickname: true,
          },
        },
      },
    }),
    prisma.person.findMany({
      where: {
        userId,
        contactReminderEnabled: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        lastContact: true,
        contactReminderInterval: true,
        contactReminderIntervalUnit: true,
      },
    }),
  ]);

  const upcomingEvents: UpcomingEvent[] = [];

  // Process important dates
  for (const importantDate of importantDates) {
    let eventDate: Date;

    if (importantDate.reminderType === 'ONCE') {
      eventDate = parseAsLocalDate(importantDate.date);
    } else {
      const interval = importantDate.reminderInterval || 1;
      const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';
      eventDate = getNextOccurrence(
        parseAsLocalDate(importantDate.date),
        today,
        interval,
        intervalUnit,
        importantDate.lastReminderSent
      );
    }

    const daysUntil = getDaysUntil(eventDate, today);

    if (daysUntil >= 0 && daysUntil <= 30) {
      upcomingEvents.push({
        id: `important-${importantDate.id}`,
        personId: importantDate.person.id,
        personName: formatFullName(importantDate.person),
        type: 'important_date',
        title: importantDate.title,
        titleKey: null,
        date: eventDate,
        daysUntil,
      });
    }
  }

  // Process contact reminders
  for (const person of peopleWithContactReminders) {
    const interval = person.contactReminderInterval || 1;
    const unit = person.contactReminderIntervalUnit || 'MONTHS';
    const intervalMs = getIntervalMs(interval, unit);

    const referenceDate = person.lastContact ? new Date(person.lastContact) : null;

    if (referenceDate) {
      const reminderDueDate = new Date(referenceDate.getTime() + intervalMs);
      reminderDueDate.setHours(0, 0, 0, 0);

      const daysUntil = getDaysUntil(reminderDueDate, today);

      if (daysUntil <= 30) {
        upcomingEvents.push({
          id: `contact-${person.id}`,
          personId: person.id,
          personName: formatFullName(person),
          type: 'contact_reminder',
          title: null,
          titleKey: 'timeToCatchUp',
          date: reminderDueDate,
          daysUntil,
        });
      }
    }
  }

  // Sort by days until (soonest first)
  upcomingEvents.sort((a, b) => a.daysUntil - b.daysUntil);

  return upcomingEvents;
}
