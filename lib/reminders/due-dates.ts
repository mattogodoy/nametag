import { parseCalendarDate, YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight local time on the same calendar day, as a new Date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface ImportantDateReminderInput {
  date: Date;
  reminderType: string | null;
  reminderInterval: number | null;
  reminderIntervalUnit: string | null;
  lastReminderSent: Date | null;
}

export interface ContactReminderInput {
  lastContact: Date | null;
  contactReminderInterval: number | null;
  contactReminderIntervalUnit: string | null;
  lastContactReminderSent: Date | null;
}

export function shouldSendImportantDateReminder(
  importantDate: ImportantDateReminderInput,
  today: Date
): boolean {
  const eventDate = parseCalendarDate(importantDate.date);

  if (importantDate.reminderType === 'ONCE') {
    // For one-time reminders, send on the exact date if not already sent
    const eventDay = startOfDay(eventDate);

    if (eventDay.getTime() !== today.getTime()) {
      return false;
    }

    // Check if already sent today
    if (importantDate.lastReminderSent) {
      const lastSent = startOfDay(importantDate.lastReminderSent);
      if (lastSent.getTime() === today.getTime()) {
        return false;
      }
    }

    return true;
  }

  if (importantDate.reminderType === 'RECURRING') {
    // For recurring reminders, check based on the interval from the event date
    const interval = importantDate.reminderInterval || 1;
    const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';

    // Normalize the event date
    const eventDateNormalized = startOfDay(eventDate);

    // Don't send reminders before the event date
    if (today.getTime() < eventDateNormalized.getTime()) {
      return false;
    }

    // Special handling for YEARS to avoid leap year drift
    if (intervalUnit === 'YEARS') {
      // Project the anniversary into the current year the same way the
      // dashboard's getNextOccurrence does: a February 29 birthday has no
      // matching day in non-leap years, and the Date constructor rolls it to
      // March 1. A plain month/day equality check would never fire that year.
      const thisYearOccurrence = startOfDay(
        new Date(
          today.getFullYear(),
          eventDateNormalized.getMonth(),
          eventDateNormalized.getDate()
        )
      );

      // Check if today is the anniversary
      if (thisYearOccurrence.getTime() !== today.getTime()) {
        return false;
      }

      // If we've sent before, check if enough years have passed
      if (importantDate.lastReminderSent) {
        const lastSent = new Date(importantDate.lastReminderSent);
        const lastSentYear = lastSent.getFullYear();
        const todayYear = today.getFullYear();
        const yearsSinceLastSent = todayYear - lastSentYear;

        return yearsSinceLastSent >= interval;
      }

      // Never sent before - it's the anniversary, so send
      return true;
    }

    // For other intervals (DAYS, WEEKS, MONTHS), use millisecond calculations
    const intervalMs = getIntervalMs(interval, intervalUnit);

    // If we've sent before, check if enough time has passed
    if (importantDate.lastReminderSent) {
      const lastSent = startOfDay(importantDate.lastReminderSent);

      const timeSinceLastSent = today.getTime() - lastSent.getTime();

      // Not enough time has passed since last reminder
      if (timeSinceLastSent < intervalMs) {
        return false;
      }

      // Calculate the next scheduled reminder date from last sent
      const intervalsPassed = Math.floor(timeSinceLastSent / intervalMs);
      const nextReminderDate = startOfDay(new Date(lastSent.getTime() + (intervalsPassed * intervalMs)));

      return nextReminderDate.getTime() === today.getTime();
    }

    // Never sent before - check if we should send based on event date
    // For unknown-year dates, normalize to current year to avoid
    // DST drift over centuries breaking the interval math
    if (eventDateNormalized.getFullYear() <= YEAR_UNKNOWN_SENTINEL) {
      const currentYear = today.getFullYear();
      eventDateNormalized.setFullYear(currentYear);
      // If the normalized date is in the future, use previous year
      if (eventDateNormalized.getTime() > today.getTime()) {
        eventDateNormalized.setFullYear(currentYear - 1);
      }
    }
    const timeSinceEvent = today.getTime() - eventDateNormalized.getTime();

    // Calculate which occurrence this is
    const intervalsPassed = Math.floor(timeSinceEvent / intervalMs);
    const nextReminderDate = startOfDay(new Date(eventDateNormalized.getTime() + (intervalsPassed * intervalMs)));

    return nextReminderDate.getTime() === today.getTime();
  }

  return false;
}

export function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = MS_PER_DAY;

  switch (unit) {
    case 'DAYS':
      return interval * msPerDay;
    case 'WEEKS':
      return interval * 7 * msPerDay;
    case 'MONTHS':
      return interval * 30 * msPerDay; // Approximate
    case 'YEARS':
      return interval * 365 * msPerDay; // Approximate
    default:
      return 365 * msPerDay;
  }
}

/** The same interval as whole days. MONTHS and YEARS stay approximate. */
export function getIntervalDays(interval: number, unit: string): number {
  return Math.round(getIntervalMs(interval, unit) / MS_PER_DAY);
}

export function shouldSendContactReminder(
  person: ContactReminderInput,
  today: Date
): boolean {
  const interval = person.contactReminderInterval || 1;
  const unit = person.contactReminderIntervalUnit || 'MONTHS';
  const intervalDays = getIntervalDays(interval, unit);

  // Calculate when the reminder should be sent
  // If no lastContact, use lastContactReminderSent or send immediately
  const reference = person.lastContact ?? person.lastContactReminderSent;

  if (!reference) {
    // No reference date - don't send (need at least one contact first)
    return false;
  }

  // lastContact is a stored calendar date (UTC midnight); anchor it to the
  // local calendar day before comparing against local-midnight today, and
  // compare in whole days so DST transitions cannot shift the send day.
  const referenceDate = startOfDay(
    person.lastContact ? parseCalendarDate(person.lastContact) : new Date(reference)
  );

  const daysSinceReference = Math.round(
    (today.getTime() - referenceDate.getTime()) / MS_PER_DAY
  );

  // Check if enough time has passed since last contact
  if (daysSinceReference < intervalDays) {
    return false;
  }

  // Check if we've already sent a reminder recently
  if (person.lastContactReminderSent) {
    const lastReminder = startOfDay(person.lastContactReminderSent);
    const daysSinceLastReminder = Math.round(
      (today.getTime() - lastReminder.getTime()) / MS_PER_DAY
    );

    // Don't send if we sent a reminder within the interval period
    if (daysSinceLastReminder < intervalDays * 0.9) {
      return false;
    }
  }

  return true;
}

export interface LeadReminderInput {
  /** The next time this event occurs, from getNextOccurrence(). */
  nextOccurrence: Date;
  today: Date;
  /** Already resolved through resolveLeadDays(). 0 means day-of only. */
  leadDays: number;
  lastLeadReminderSent: Date | null;
  /**
   * Whole days between consecutive occurrences, for RECURRING dates. Omit for
   * ONCE, which never repeats. Used only to clamp the lead window.
   */
  intervalDays?: number | null;
}

/**
 * Whether an advance-notice email is due today for this occurrence.
 *
 * The window runs from `nextOccurrence - leadDays` up to, but not including,
 * the occurrence itself, which the day-of reminder owns.
 *
 * The `lastLeadReminderSent < windowStart` check does double duty. Within a
 * window it prevents a repeat send. Across occurrences it re-arms, because
 * last year's send necessarily predates this year's window. That is why no
 * per-occurrence tracking table is needed.
 *
 * A consequence worth knowing: if the window is already open when the user
 * first sets a lead time, the email fires that same day rather than being
 * skipped. Late notice beats none.
 *
 * That re-arming trick only holds while windows do not overlap. A 7-day lead
 * on a date recurring every 3 days would reach back past the previous
 * occurrence, so the previous send would sit inside the current window and
 * silently suppress every other occurrence. Clamping the lead to the interval
 * keeps consecutive windows disjoint, at the cost of shortening the notice for
 * dates that recur faster than the requested lead time, which is the only
 * sensible reading of "tell me 7 days before" for something happening weekly.
 */
export function shouldSendLeadReminder({
  nextOccurrence,
  today,
  leadDays,
  lastLeadReminderSent,
  intervalDays,
}: LeadReminderInput): boolean {
  if (leadDays <= 0) return false;

  const effectiveLeadDays =
    intervalDays && intervalDays > 0 ? Math.min(leadDays, intervalDays) : leadDays;

  const occurrence = startOfDay(nextOccurrence);
  const todayStart = startOfDay(today);

  const windowStart = new Date(occurrence);
  windowStart.setDate(windowStart.getDate() - effectiveLeadDays);

  if (todayStart.getTime() < windowStart.getTime()) return false;
  if (todayStart.getTime() >= occurrence.getTime()) return false;

  if (
    lastLeadReminderSent &&
    startOfDay(lastLeadReminderSent).getTime() >= windowStart.getTime()
  ) {
    return false;
  }

  return true;
}
