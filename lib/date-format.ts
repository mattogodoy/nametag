type DateFormat = 'MDY' | 'DMY' | 'YMD';

export function formatDate(date: Date | string, format: DateFormat): string {
  const d = typeof date === 'string' ? new Date(date) : date;

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
