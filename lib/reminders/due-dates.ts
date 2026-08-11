import { parseAsLocalDate } from '@/lib/date-format';

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
  const eventDate = parseAsLocalDate(importantDate.date);

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
      const eventDay = eventDateNormalized.getDate();
      const eventMonth = eventDateNormalized.getMonth();
      const todayDay = today.getDate();
      const todayMonth = today.getMonth();

      // Check if today is the anniversary (same month and day)
      if (todayDay !== eventDay || todayMonth !== eventMonth) {
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
    // For unknown-year dates (year <= 1604), normalize to current year to avoid
    // DST drift over centuries breaking the interval math
    if (eventDateNormalized.getFullYear() <= 1604) {
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
  const msPerDay = 24 * 60 * 60 * 1000;

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

export function shouldSendContactReminder(
  person: ContactReminderInput,
  today: Date
): boolean {
  const interval = person.contactReminderInterval || 1;
  const unit = person.contactReminderIntervalUnit || 'MONTHS';
  const intervalMs = getIntervalMs(interval, unit);

  // Calculate when the reminder should be sent
  // If no lastContact, use lastContactReminderSent or send immediately
  const referenceDate = person.lastContact || person.lastContactReminderSent;

  if (!referenceDate) {
    // No reference date - don't send (need at least one contact first)
    return false;
  }

  const timeSinceReference = today.getTime() - new Date(referenceDate).getTime();

  // Check if enough time has passed since last contact
  if (timeSinceReference < intervalMs) {
    return false;
  }

  // Check if we've already sent a reminder recently
  if (person.lastContactReminderSent) {
    const timeSinceLastReminder =
      today.getTime() - new Date(person.lastContactReminderSent).getTime();

    // Don't send if we sent a reminder within the interval period
    if (timeSinceLastReminder < intervalMs * 0.9) {
      return false;
    }
  }

  return true;
}
