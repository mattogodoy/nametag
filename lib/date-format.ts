export type DateFormat = 'MDY' | 'DMY' | 'YMD';

/**
 * Parse a date-only value as a Date anchored at local midnight on the encoded
 * calendar day. Accepts `YYYY-MM-DD` and ISO datetime strings (where only the
 * date prefix is meaningful — Nametag stores calendar dates as UTC-midnight
 * DateTime values, which would otherwise shift west of UTC under `getDate()`).
 * Date objects pass through unchanged, on the assumption that they were built
 * locally and already sit on the right calendar day; for a Date read from the
 * database use `parseCalendarDate`. For real timestamps use `formatDateTime`.
 */
export function parseAsLocalDate(date: Date | string): Date {
  if (typeof date === 'string') {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateOnlyPattern.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    // ISO datetime: take the date part and anchor it locally so the calendar
    // day is preserved across timezones.
    const isoDatePrefixPattern = /^(\d{4})-(\d{2})-(\d{2})T/;
    const match = isoDatePrefixPattern.exec(date);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
    return new Date(date);
  }
  return date;
}

/**
 * Anchor a calendar-date column to local midnight on the day it encodes.
 *
 * Use this for any birthday, anniversary or last-contact value read from the
 * database. Those are stored as UTC midnight, so a `Date` handed straight to
 * `parseAsLocalDate` passes through untouched and the formatters then read it
 * with `getDate()`, reporting the previous day anywhere west of UTC.
 *
 * Year-unknown dates make that far wider than it sounds. They use 1604, which
 * predates standard time zones, so JavaScript falls back to Local Mean Time and
 * puts almost every zone west of UTC: Madrid is -0:14:44 and London is -0:01:15
 * in 1604, though both are east of UTC today. Reading the UTC components is the
 * only way to get the stored calendar day back out.
 */
export function parseCalendarDate(date: Date | string): Date {
  if (typeof date === 'string') {
    return parseAsLocalDate(date);
  }
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Apple's marker year for dates whose year is unknown. It predates standard
 * time zones, which is why these values must always be read as UTC calendar
 * days (see `parseCalendarDate`). Legacy rows written through local-time paths
 * can sit slightly below it, so checks use `<=` rather than equality.
 */
export const YEAR_UNKNOWN_SENTINEL = 1604;

/** Build the stored form of a year-unknown calendar date: UTC midnight under the sentinel year. */
export function yearUnknownDate(monthIndex: number, day: number): Date {
  return new Date(Date.UTC(YEAR_UNKNOWN_SENTINEL, monthIndex, day));
}

/** True when a stored calendar date (Date or string) carries the year-unknown sentinel. */
export function isYearUnknownDate(date: Date | string): boolean {
  return parseCalendarDate(date).getFullYear() <= YEAR_UNKNOWN_SENTINEL;
}

/**
 * Today's calendar date in the viewer's local timezone, as `YYYY-MM-DD`.
 * Use instead of `new Date().toISOString().split('T')[0]`, which is UTC and
 * rolls forward after UTC midnight for users west of UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(date: Date | string, format: DateFormat): string {
  const d = parseAsLocalDate(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  switch (format) {
    case 'MDY':
      return `${month}/${day}/${year}`;
    case 'DMY':
      return `${day}/${month}/${year}`;
    case 'YMD':
      return `${year}-${month}-${day}`;
    default:
      return `${month}/${day}/${year}`;
  }
}

export function formatDateWithoutYear(date: Date | string, format: DateFormat): string {
  const d = parseAsLocalDate(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = d.getDate();
  const monthName = d.toLocaleDateString('en-US', { month: 'long' });

  // For DMY format, show "day Month" (e.g., "5 January")
  // For MDY and YMD formats, show "Month day" (e.g., "January 5")
  switch (format) {
    case 'DMY':
      return `${day} ${monthName}`;
    case 'MDY':
    case 'YMD':
    default:
      return `${monthName} ${day}`;
  }
}

export function getDateFormatLabel(format: DateFormat): string {
  switch (format) {
    case 'MDY':
      return 'MM/DD/YYYY';
    case 'DMY':
      return 'DD/MM/YYYY';
    case 'YMD':
      return 'YYYY-MM-DD';
    default:
      return 'MM/DD/YYYY';
  }
}

export function getDateFormatExample(format: DateFormat): string {
  const exampleDate = new Date(2024, 11, 31); // December 31, 2024
  return formatDate(exampleDate, format);
}

export function formatDateTime(date: Date | string, format: DateFormat = 'MDY'): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  let dateStr: string;
  switch (format) {
    case 'MDY':
      dateStr = `${month}/${day}/${year}`;
      break;
    case 'DMY':
      dateStr = `${day}/${month}/${year}`;
      break;
    case 'YMD':
      dateStr = `${year}-${month}-${day}`;
      break;
    default:
      dateStr = `${month}/${day}/${year}`;
  }

  return `${dateStr}, ${hours}:${minutes}`;
}
