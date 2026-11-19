import { describe, it, expect } from 'vitest';
import {
  buildMonthGrid,
  formatMonthParam,
  getFirstDayOfWeek,
  parseMonthParam,
  shiftMonth,
} from '@/lib/calendar-month';

describe('parseMonthParam', () => {
  const now = new Date(2026, 10, 8);

  it('reads a YYYY-MM value', () => {
    expect(parseMonthParam('2025-03', now)).toEqual({ year: 2025, monthIndex: 2 });
    expect(parseMonthParam('2025-12', now)).toEqual({ year: 2025, monthIndex: 11 });
  });

  it.each([undefined, '', 'abc', '2025-13', '2025-00', '2025-3', '25-03', '2025-03-01', '1800-01', '2500-01'])(
    'falls back to the current month for %j',
    (value) => {
      expect(parseMonthParam(value, now)).toEqual({ year: 2026, monthIndex: 10 });
    }
  );
});

describe('formatMonthParam', () => {
  it('pads the month', () => {
    expect(formatMonthParam({ year: 2026, monthIndex: 0 })).toBe('2026-01');
    expect(formatMonthParam({ year: 2026, monthIndex: 11 })).toBe('2026-12');
  });

  it('round-trips through parseMonthParam', () => {
    const ref = { year: 2031, monthIndex: 6 };
    expect(parseMonthParam(formatMonthParam(ref))).toEqual(ref);
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 11 }, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth({ year: 2026, monthIndex: 0 }, -1)).toEqual({ year: 2025, monthIndex: 11 });
  });

  it('stays put for a shift of zero', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 5 }, 0)).toEqual({ year: 2026, monthIndex: 5 });
  });
});

describe('getFirstDayOfWeek', () => {
  it('returns a weekday number from 0 to 6', () => {
    for (const locale of ['en', 'de-DE', 'es-ES', 'ja-JP', 'ru-RU', 'zh-CN']) {
      const first = getFirstDayOfWeek(locale);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(6);
    }
  });

  it('starts the week on Monday in Germany and on Sunday in the US', () => {
    expect(getFirstDayOfWeek('de-DE')).toBe(1);
    expect(getFirstDayOfWeek('en-US')).toBe(0);
  });

  it('does not throw on a malformed locale', () => {
    expect(getFirstDayOfWeek('not a locale')).toBe(1);
  });
});

describe('buildMonthGrid', () => {
  it('pads the first and last week with empty cells (Monday start)', () => {
    // November 2026 starts on a Sunday and has 30 days.
    const weeks = buildMonthGrid({ year: 2026, monthIndex: 10 }, 1);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, 1]);
    expect(weeks[weeks.length - 1]).toEqual([30, null, null, null, null, null, null]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('shifts the leading blanks with a Sunday start', () => {
    const weeks = buildMonthGrid({ year: 2026, monthIndex: 10 }, 0);
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('contains every day of the month exactly once, in order', () => {
    const days = buildMonthGrid({ year: 2024, monthIndex: 1 }, 1)
      .flat()
      .filter((cell): cell is number => cell !== null);
    expect(days).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
  });

  it('needs no padding for a four-week February that starts on the first weekday', () => {
    // February 2027 starts on a Monday and has 28 days.
    const weeks = buildMonthGrid({ year: 2027, monthIndex: 1 }, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe(1);
    expect(weeks[3][6]).toBe(28);
  });
});
