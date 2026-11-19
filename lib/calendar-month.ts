export interface MonthRef {
  year: number;
  /** Zero-based month, as in `Date`. */
  monthIndex: number;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

/** Locales whose week starts on Sunday, for browsers that cannot say so themselves. */
const SUNDAY_FIRST_LOCALES = new Set(['en', 'ja-JP']);

export function formatMonthParam({ year, monthIndex }: MonthRef): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** Read the `?month=YYYY-MM` query value, falling back to the current month. */
export function parseMonthParam(value: string | undefined, now: Date = new Date()): MonthRef {
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null;
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year >= MIN_YEAR && year <= MAX_YEAR && month >= 1 && month <= 12) {
      return { year, monthIndex: month - 1 };
    }
  }
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

export function shiftMonth({ year, monthIndex }: MonthRef, delta: number): MonthRef {
  const shifted = new Date(year, monthIndex + delta, 1);
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}

interface WeekInfoLocale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/** First day of the week for a locale, as `Date#getDay` numbers it (0 = Sunday). */
export function getFirstDayOfWeek(locale: string): number {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & WeekInfoLocale;
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    // Intl numbers the days 1 (Monday) to 7 (Sunday).
    if (info) return info.firstDay % 7;
  } catch {
    // Fall through to the static table for locales Intl cannot parse.
  }
  return SUNDAY_FIRST_LOCALES.has(locale) ? 0 : 1;
}

/** The month as rows of seven cells; days outside the month are null. */
export function buildMonthGrid(
  { year, monthIndex }: MonthRef,
  firstDayOfWeek: number
): (number | null)[][] {
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() - firstDayOfWeek + 7) % 7;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (number | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= dayCount; day++) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
