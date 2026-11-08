import { prisma } from '@/lib/prisma';
import { formatGraphName } from '@/lib/nameUtils';
import { parseCalendarDate, YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';
import { getTranslationsForLocale } from '@/lib/i18n-utils';
import { getDateDisplayTitle, isPredefinedType } from '@/lib/important-date-types';
import { getUserLocale } from '@/lib/locale';
import { getContactReminderDueDate } from '@/lib/upcoming-events';

export interface CalendarEvent {
  id: string;
  personId: string;
  personName: string;
  type: 'important_date' | 'contact_reminder';
  title: string | null;
  titleKey: 'timeToCatchUp' | null;
  /** Day of the month (1-31) the event falls on. */
  day: number;
}

export interface OccurrenceSource {
  /** The stored calendar date, already read back as a local date. */
  date: Date;
  type: string | null;
  reminderEnabled: boolean;
  reminderType: string | null;
  reminderInterval: number | null;
  reminderIntervalUnit: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Whole days between two calendar days, immune to DST shifts. */
function calendarDayNumber(year: number, monthIndex: number, day: number): number {
  return Math.round(Date.UTC(year, monthIndex, day) / MS_PER_DAY);
}

/** A February 29 date lands on March 1 in non-leap years, like its reminders do. */
function yearlyDay(date: Date, year: number, monthIndex: number): number | null {
  const month = date.getMonth();
  const day = date.getDate();
  if (month === 1 && day === 29 && daysInMonth(year, 1) === 28) {
    return monthIndex === 2 ? 1 : null;
  }
  return monthIndex === month ? day : null;
}

/**
 * Days of the given month on which an important date shows up in the calendar.
 *
 * Unlike the dashboard, the calendar lists every important date, not only the
 * ones with a reminder. Birthdays, anniversaries, name days and memorials are
 * yearly by nature. A custom date happens once, on the day it was saved, unless
 * a recurring reminder says otherwise. A date without a year can only be yearly.
 */
export function getOccurrenceDays(source: OccurrenceSource, year: number, monthIndex: number): number[] {
  const { date } = source;
  const startYear = date.getFullYear();
  const yearUnknown = startYear <= YEAR_UNKNOWN_SENTINEL;

  if (!yearUnknown && year < startYear) return [];

  const recurring = source.reminderEnabled && source.reminderType === 'RECURRING';
  const predefined = source.type !== null && isPredefinedType(source.type);

  if (yearUnknown || (!recurring && predefined)) {
    const day = yearlyDay(date, year, monthIndex);
    return day === null ? [] : [day];
  }

  if (!recurring) {
    // ONCE reminders and plain custom dates both sit on their own day only.
    return year === startYear && monthIndex === date.getMonth() ? [date.getDate()] : [];
  }

  const interval = source.reminderInterval || 1;
  switch (source.reminderIntervalUnit || 'YEARS') {
    case 'YEARS': {
      if ((year - startYear) % interval !== 0) return [];
      const day = yearlyDay(date, year, monthIndex);
      return day === null ? [] : [day];
    }
    case 'MONTHS': {
      const monthsSince = (year - startYear) * 12 + (monthIndex - date.getMonth());
      if (monthsSince < 0 || monthsSince % interval !== 0) return [];
      return [Math.min(date.getDate(), daysInMonth(year, monthIndex))];
    }
    case 'WEEKS':
    case 'DAYS': {
      const stepDays = source.reminderIntervalUnit === 'WEEKS' ? interval * 7 : interval;
      const origin = calendarDayNumber(startYear, date.getMonth(), date.getDate());
      const days: number[] = [];
      for (let day = 1; day <= daysInMonth(year, monthIndex); day++) {
        const since = calendarDayNumber(year, monthIndex, day) - origin;
        if (since >= 0 && since % stepDays === 0) days.push(day);
      }
      return days;
    }
    default:
      return [];
  }
}

/**
 * Everything the calendar shows for one month: important dates and the days
 * contact reminders fall due.
 *
 * @param monthIndex Zero-based month, as in `Date`.
 */
export async function getCalendarEvents(
  userId: string,
  year: number,
  monthIndex: number
): Promise<CalendarEvent[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { nameOrder: true, nameDisplayFormat: true },
  });

  const personSelect = {
    id: true,
    name: true,
    surname: true,
    nickname: true,
    displayNameOverride: true,
  } as const;

  const [importantDates, peopleWithContactReminders] = await Promise.all([
    prisma.importantDate.findMany({
      where: {
        person: { userId, deletedAt: null },
        deletedAt: null,
      },
      include: { person: { select: personSelect } },
    }),
    prisma.person.findMany({
      where: {
        userId,
        contactReminderEnabled: true,
        deletedAt: null,
      },
      select: {
        ...personSelect,
        lastContact: true,
        contactReminderInterval: true,
        contactReminderIntervalUnit: true,
      },
    }),
  ]);

  const userLocale = await getUserLocale(userId);
  const tDates = await getTranslationsForLocale(userLocale, 'people.form.importantDates');

  const events: CalendarEvent[] = [];

  for (const importantDate of importantDates) {
    const days = getOccurrenceDays(
      {
        date: parseCalendarDate(importantDate.date),
        type: importantDate.type,
        reminderEnabled: importantDate.reminderEnabled,
        reminderType: importantDate.reminderType,
        reminderInterval: importantDate.reminderInterval,
        reminderIntervalUnit: importantDate.reminderIntervalUnit,
      },
      year,
      monthIndex
    );

    for (const day of days) {
      events.push({
        id: `important-${importantDate.id}-${day}`,
        personId: importantDate.person.id,
        personName: formatGraphName(importantDate.person, user?.nameOrder, user?.nameDisplayFormat),
        type: 'important_date',
        title: getDateDisplayTitle(importantDate, tDates),
        titleKey: null,
        day,
      });
    }
  }

  for (const person of peopleWithContactReminders) {
    const dueDate = getContactReminderDueDate(
      person.lastContact,
      person.contactReminderInterval,
      person.contactReminderIntervalUnit
    );

    if (dueDate && dueDate.getFullYear() === year && dueDate.getMonth() === monthIndex) {
      events.push({
        id: `contact-${person.id}`,
        personId: person.id,
        personName: formatGraphName(person, user?.nameOrder, user?.nameDisplayFormat),
        type: 'contact_reminder',
        title: null,
        titleKey: 'timeToCatchUp',
        day: dueDate.getDate(),
      });
    }
  }

  events.sort((a, b) => a.day - b.day || a.personName.localeCompare(b.personName));

  return events;
}
