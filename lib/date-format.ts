type DateFormat = 'MDY' | 'DMY' | 'YMD';

/**
 * Parse a date string or Date object as a local date, avoiding timezone issues.
 * Date-only strings (YYYY-MM-DD) are parsed as local dates instead of UTC.
 */
export function parseAsLocalDate(date: Date | string): Date {
  if (typeof date === 'string') {
    // Parse date-only strings (YYYY-MM-DD) as local dates to avoid timezone issues
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateOnlyPattern.test(date)) {
      const [year, month, day] = date.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(date);
  }
  return date;
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
  const monthName = d.toLocaleDateString(undefined, { month: 'long' });

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
