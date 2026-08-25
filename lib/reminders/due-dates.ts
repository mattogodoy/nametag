import { parseCalendarDate } from '@/lib/date-format';
import { getNextOccurrence, getIntervalMs } from '@/lib/upcoming-events';

export { getIntervalMs };

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
    const interval = importantDate.reminderInterval || 1;
    const intervalUnit = importantDate.reminderIntervalUnit || 'YEARS';

    const next = getNextOccurrence(
      eventDate,
      today,
      interval,
      intervalUnit,
      importantDate.lastReminderSent
    );

    if (startOfDay(next).getTime() !== today.getTime()) {
      return false;
    }

    if (importantDate.lastReminderSent) {
      const lastSent = startOfDay(importantDate.lastReminderSent);
      if (lastSent.getTime() === today.getTime()) {
        return false;
      }
    }

    return true;
  }

  return false;
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
