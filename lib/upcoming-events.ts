import { prisma } from '@/lib/prisma';
import { formatGraphName } from '@/lib/nameUtils';
import { parseCalendarDate, YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';
import { getTranslationsForLocale } from '@/lib/i18n-utils';
import { getDateDisplayTitle } from '@/lib/important-date-types';
import { getUserLocale } from '@/lib/locale';

export interface UpcomingEvent {
  id: string;
  personId: string;
  personName: string;
  type: 'important_date' | 'contact_reminder';
  title: string | null;
  titleKey: 'timeToCatchUp' | null;
  date: Date;
  daysUntil: number;
  isYearUnknown: boolean;
  personPhoto?: string | null;
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

  if (intervalUnit === 'YEARS') {
    const eventYear = eventDate.getFullYear();
    const isUnknownYear = eventYear <= YEAR_UNKNOWN_SENTINEL;

    const anchorYear = isUnknownYear
      ? (lastReminderSent ? lastReminderSent.getFullYear() : eventYear)
      : eventYear;

    const thisYearOccurrence = new Date(
      today.getFullYear(),
      eventDate.getMonth(),
      eventDate.getDate()
    );
    thisYearOccurrence.setHours(0, 0, 0, 0);

    let candidateYear = thisYearOccurrence.getTime() >= todayNormalized.getTime()
      ? today.getFullYear()
      : today.getFullYear() + 1;

    // Don't return before interval years have elapsed since lastReminderSent
    if (lastReminderSent) {
      const minYear = lastReminderSent.getFullYear() + interval;
      if (candidateYear < minYear) {
        candidateYear = minYear;
      }
    }

    // Advance to the next year on the interval grid
    const yearsSinceAnchor = candidateYear - anchorYear;
    const remainder = ((yearsSinceAnchor % interval) + interval) % interval;
    if (remainder !== 0) {
      candidateYear += interval - remainder;
    }

    // Don't return a date before a known future event
    if (!isUnknownYear && candidateYear < eventYear) {
      candidateYear = eventYear;
    }

    const result = new Date(
      candidateYear,
      eventDate.getMonth(),
      eventDate.getDate()
    );
    result.setHours(0, 0, 0, 0);
    return result;
  }

  // For other intervals (DAYS, WEEKS, MONTHS):
  // Normalize unknown-year sentinel to the current year to avoid centuries of
  // 30-day-month approximation compounding into multi-day drift.
  let referenceDate: Date;
  if (lastReminderSent) {
    referenceDate = new Date(lastReminderSent);
  } else if (eventDateNormalized.getFullYear() <= YEAR_UNKNOWN_SENTINEL) {
    referenceDate = new Date(eventDateNormalized);
    referenceDate.setFullYear(today.getFullYear());
    if (referenceDate.getTime() > todayNormalized.getTime()) {
      referenceDate.setFullYear(today.getFullYear() - 1);
    }
  } else {
    referenceDate = new Date(eventDateNormalized);
  }
  referenceDate.setHours(0, 0, 0, 0);

  if (referenceDate.getTime() > todayNormalized.getTime()) {
    return referenceDate;
  }

  const intervalMs = getIntervalMs(interval, intervalUnit);

  // Compare in whole days so DST transitions (which shift local midnight by
  // up to 1 hour) cannot cause the boundary check to miss.
  const daysSinceReference = Math.round(
    (todayNormalized.getTime() - referenceDate.getTime()) / MS_PER_DAY
  );
  const intervalDays = Math.round(intervalMs / MS_PER_DAY);

  // The event date itself is an occurrence; lastReminderSent is not (already sent)
  if (!lastReminderSent && daysSinceReference === 0) {
    return todayNormalized;
  }

  // Return today when it falls exactly on a later interval boundary
  if (daysSinceReference > 0 && daysSinceReference % intervalDays === 0) {
    return todayNormalized;
  }

  const nextBoundaryDays = (Math.floor(daysSinceReference / intervalDays) + 1) * intervalDays;
  const nextOccurrence = new Date(referenceDate);
  nextOccurrence.setDate(nextOccurrence.getDate() + nextBoundaryDays);
  nextOccurrence.setHours(0, 0, 0, 0);

  return nextOccurrence;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = MS_PER_DAY;
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

  // Fetch user's nameOrder preference
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nameOrder: true, language: true, nameDisplayFormat: true },
  });
  const nameOrder = user?.nameOrder;
  const nameDisplayFormat = user?.nameDisplayFormat;

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
            displayNameOverride: true,
            photo: true,
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
        displayNameOverride: true,
        photo: true,
        lastContact: true,
        contactReminderInterval: true,
        contactReminderIntervalUnit: true,
      },
    }),
  ]);

  const upcomingEvents: UpcomingEvent[] = [];

  // Get user locale and translations for date titles
  const userLocale = await getUserLocale(userId);
  const tDates = await getTranslationsForLocale(userLocale, 'people.form.importantDates');

  // Process important dates
  for (const importantDate of importantDates) {
    const storedDate = parseCalendarDate(importantDate.date);
    let eventDate: Date;

    if (importantDate.reminderType === 'ONCE') {
      eventDate = storedDate;
    } else {
      const interval = importantDate.reminderInterval || 1;
      const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';
      eventDate = getNextOccurrence(
        storedDate,
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
        personName: formatGraphName(importantDate.person, nameOrder, nameDisplayFormat),
        type: 'important_date',
        title: getDateDisplayTitle(importantDate, tDates),
        titleKey: null,
        date: eventDate,
        daysUntil,
        isYearUnknown: storedDate.getFullYear() <= YEAR_UNKNOWN_SENTINEL,
        personPhoto: importantDate.person.photo,
      });
    }
  }

  // Process contact reminders
  for (const person of peopleWithContactReminders) {
    const interval = person.contactReminderInterval || 1;
    const unit = person.contactReminderIntervalUnit || 'MONTHS';
    const intervalMs = getIntervalMs(interval, unit);

    // lastContact is a stored calendar date (UTC midnight); anchor it to the
    // local calendar day before doing day arithmetic, and add whole days
    // rather than milliseconds so DST transitions cannot shift the result.
    const referenceDate = person.lastContact ? parseCalendarDate(person.lastContact) : null;

    if (referenceDate) {
      const intervalDays = Math.round(intervalMs / MS_PER_DAY);
      const reminderDueDate = new Date(referenceDate);
      reminderDueDate.setDate(reminderDueDate.getDate() + intervalDays);
      reminderDueDate.setHours(0, 0, 0, 0);

      const daysUntil = getDaysUntil(reminderDueDate, today);

      if (daysUntil <= 30) {
        upcomingEvents.push({
          id: `contact-${person.id}`,
          personId: person.id,
          personName: formatGraphName(person, nameOrder, nameDisplayFormat),
          type: 'contact_reminder',
          title: null,
          titleKey: 'timeToCatchUp',
          date: reminderDueDate,
          daysUntil,
          isYearUnknown: false,
          personPhoto: person.photo,
        });
      }
    }
  }

  // Sort by days until (soonest first)
  upcomingEvents.sort((a, b) => a.daysUntil - b.daysUntil);

  return upcomingEvents;
}
