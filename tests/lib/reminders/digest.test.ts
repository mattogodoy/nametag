import { describe, it, expect } from 'vitest';
import {
  DIGEST_MAX_ROWS,
  isDigestDueToday,
  selectDigestEvents,
} from '@/lib/reminders/digest';
import type { UpcomingEvent } from '@/lib/upcoming-events';

// 2026-05-11 is a Monday.
const monday = new Date('2026-05-11T08:00:00');
const tuesday = new Date('2026-05-12T08:00:00');

function event(daysUntil: number, id = `e-${daysUntil}`): UpcomingEvent {
  return {
    id,
    personId: 'p-1',
    personName: 'Sarah Chen',
    type: 'important_date',
    title: 'Birthday',
    titleKey: null,
    date: new Date('2026-05-12T00:00:00'),
    daysUntil,
    isYearUnknown: false,
    personPhoto: null,
  };
}

describe('isDigestDueToday', () => {
  it('is due on the chosen weekday', () => {
    expect(
      isDigestDueToday(
        { weeklyDigestEnabled: true, weeklyDigestWeekday: 1, lastWeeklyDigestSent: null },
        monday
      )
    ).toBe(true);
  });

  it('is not due on any other weekday', () => {
    expect(
      isDigestDueToday(
        { weeklyDigestEnabled: true, weeklyDigestWeekday: 1, lastWeeklyDigestSent: null },
        tuesday
      )
    ).toBe(false);
  });

  it('is not due when the user has not opted in', () => {
    expect(
      isDigestDueToday(
        { weeklyDigestEnabled: false, weeklyDigestWeekday: 1, lastWeeklyDigestSent: null },
        monday
      )
    ).toBe(false);
  });

  // Guards against a self-hoster whose cron fires twice in one morning.
  it('is not due when one was already sent in the last 6 days', () => {
    expect(
      isDigestDueToday(
        {
          weeklyDigestEnabled: true,
          weeklyDigestWeekday: 1,
          lastWeeklyDigestSent: new Date('2026-05-11T02:00:00'),
        },
        monday
      )
    ).toBe(false);
  });

  it('is due again a full week later', () => {
    expect(
      isDigestDueToday(
        {
          weeklyDigestEnabled: true,
          weeklyDigestWeekday: 1,
          lastWeeklyDigestSent: new Date('2026-05-04T08:00:00'),
        },
        monday
      )
    ).toBe(true);
  });
});

describe('selectDigestEvents', () => {
  it('keeps events inside the next 7 days', () => {
    const result = selectDigestEvents([event(0), event(3), event(7)]);
    expect(result.events).toHaveLength(3);
    expect(result.overflowCount).toBe(0);
  });

  it('drops events beyond 7 days', () => {
    const result = selectDigestEvents([event(3), event(8), event(30)]);
    expect(result.events).toHaveLength(1);
  });

  // getUpcomingEvents returns negative daysUntil for overdue catch-ups.
  // Including them would dump a months-long backlog into the first digest.
  it('drops overdue contact reminders', () => {
    const overdue = { ...event(-40, 'e-overdue'), type: 'contact_reminder' as const };
    const result = selectDigestEvents([overdue, event(2)]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].id).toBe('e-2');
  });

  it('caps the list and reports the overflow count', () => {
    const many = Array.from({ length: 30 }, (_, i) => event(i % 8, `e-${i}`));
    const result = selectDigestEvents(many);
    expect(result.events).toHaveLength(DIGEST_MAX_ROWS);
    expect(result.overflowCount).toBe(5);
  });

  it('returns an empty list when nothing is in range', () => {
    const result = selectDigestEvents([event(12), event(20)]);
    expect(result.events).toHaveLength(0);
    expect(result.overflowCount).toBe(0);
  });

  it('sorts events by daysUntil in ascending order', () => {
    const unordered = [event(5, 'e-5'), event(0, 'e-0'), event(7, 'e-7'), event(2, 'e-2')];
    const result = selectDigestEvents(unordered);
    expect(result.events).toHaveLength(4);
    const daysUntilSequence = result.events.map((e) => e.daysUntil);
    expect(daysUntilSequence).toEqual([0, 2, 5, 7]);
  });

  it('does not mutate the input array', () => {
    const original = [event(5, 'e-5'), event(0, 'e-0'), event(7, 'e-7'), event(2, 'e-2')];
    const originalOrder = original.map((e) => e.daysUntil);
    selectDigestEvents(original);
    const finalOrder = original.map((e) => e.daysUntil);
    expect(finalOrder).toEqual(originalOrder);
  });
});
