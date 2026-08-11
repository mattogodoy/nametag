import type { UpcomingEvent } from '@/lib/upcoming-events';

/** How far ahead the digest looks. */
export const DIGEST_WINDOW_DAYS = 7;

/** Rows shown before collapsing the rest into an "and N more" link. */
export const DIGEST_MAX_ROWS = 25;

/** Blocks a second send if the cron fires twice on the same morning. */
const RESEND_GUARD_DAYS = 6;

export interface DigestUser {
  weeklyDigestEnabled: boolean;
  /** 0 = Sunday ... 6 = Saturday, matching Date.prototype.getDay(). */
  weeklyDigestWeekday: number;
  lastWeeklyDigestSent: Date | null;
}

export function isDigestDueToday(user: DigestUser, today: Date): boolean {
  if (!user.weeklyDigestEnabled) return false;
  if (today.getDay() !== user.weeklyDigestWeekday) return false;

  if (user.lastWeeklyDigestSent) {
    const msSinceLast = today.getTime() - user.lastWeeklyDigestSent.getTime();
    if (msSinceLast < RESEND_GUARD_DAYS * 24 * 60 * 60 * 1000) return false;
  }

  return true;
}

export interface DigestSelection {
  events: UpcomingEvent[];
  /** Events inside the window that did not fit under DIGEST_MAX_ROWS. */
  overflowCount: number;
}

/**
 * Narrow a user's upcoming events down to what belongs in this week's digest.
 *
 * The lower bound of 0 matters: getUpcomingEvents() reports overdue contact
 * reminders with a negative daysUntil, and a user with a long backlog would
 * otherwise receive all of it in their first digest.
 */
export function selectDigestEvents(events: UpcomingEvent[]): DigestSelection {
  const inWindow = events
    .filter((e) => e.daysUntil >= 0 && e.daysUntil <= DIGEST_WINDOW_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return {
    events: inWindow.slice(0, DIGEST_MAX_ROWS),
    overflowCount: Math.max(0, inWindow.length - DIGEST_MAX_ROWS),
  };
}
