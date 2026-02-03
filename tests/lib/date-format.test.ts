import { describe, it, expect } from 'vitest';
import { formatDate, formatDateWithoutYear, getDateFormatLabel, getDateFormatExample, parseAsLocalDate } from '@/lib/date-format';

describe('date-format', () => {
  describe('parseAsLocalDate', () => {
    describe('with date-only strings (YYYY-MM-DD)', () => {
      it('should parse date-only string as local date', () => {
        const result = parseAsLocalDate('2024-12-25');
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(11); // December is month 11
        expect(result.getDate()).toBe(25);
      });

      it('should handle February dates correctly (issue #57)', () => {
        const result = parseAsLocalDate('1993-02-08');
        expect(result.getFullYear()).toBe(1993);
        expect(result.getMonth()).toBe(1); // February is month 1
        expect(result.getDate()).toBe(8);
      });

      it('should handle first day of month', () => {
        const result = parseAsLocalDate('2024-01-01');
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
      });

      it('should handle last day of month', () => {
        const result = parseAsLocalDate('2024-12-31');
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(11);
        expect(result.getDate()).toBe(31);
      });

      it('should handle leap year date', () => {
        const result = parseAsLocalDate('2024-02-29');
        expect(result.getFullYear()).toBe(2024);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(29);
      });
    });

    describe('with Date objects', () => {
      it('should return Date object as-is', () => {
        const original = new Date(2024, 11, 25);
        const result = parseAsLocalDate(original);
        expect(result).toBe(original);
      });
    });

    describe('with ISO datetime strings', () => {
      it('should parse full ISO datetime string normally', () => {
        const isoString = '2024-12-25T10:30:00.000Z';
        const result = parseAsLocalDate(isoString);
        // Should parse as UTC datetime
        expect(result.toISOString()).toBe(isoString);
      });
    });

    describe('timezone consistency (issue #57 fix)', () => {
      it('should maintain date consistency when parsing and formatting', () => {
        // This is the core test for issue #57
        // A date string should parse and format back to the same date
        const dateString = '1993-02-08';
        const parsed = parseAsLocalDate(dateString);

        // Format back to YYYY-MM-DD
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        const formatted = `${year}-${month}-${day}`;

        expect(formatted).toBe(dateString);
      });

      it('should work correctly for all months', () => {
        const months = [
          '2024-01-15', '2024-02-15', '2024-03-15', '2024-04-15',
          '2024-05-15', '2024-06-15', '2024-07-15', '2024-08-15',
          '2024-09-15', '2024-10-15', '2024-11-15', '2024-12-15'
        ];

        months.forEach(dateString => {
          const parsed = parseAsLocalDate(dateString);
          const year = parsed.getFullYear();
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const day = String(parsed.getDate()).padStart(2, '0');
          const formatted = `${year}-${month}-${day}`;

          expect(formatted).toBe(dateString);
        });
      });

      it('should maintain date when used with formatDate', () => {
        // Integration test with formatDate
        const dateString = '1993-02-08';
        const result = formatDate(dateString, 'YMD');
        expect(result).toBe(dateString);
      });

      it('should maintain date for MDY format', () => {
        const dateString = '1993-02-08';
        const result = formatDate(dateString, 'MDY');
        expect(result).toBe('02/08/1993');
      });

      it('should maintain date for DMY format', () => {
        const dateString = '1993-02-08';
        const result = formatDate(dateString, 'DMY');
        expect(result).toBe('08/02/1993');
      });
    });
  });
  describe('formatDate', () => {
    const testDate = new Date(2024, 11, 25); // December 25, 2024

    describe('with Date object', () => {
      it('should format as MDY', () => {
        expect(formatDate(testDate, 'MDY')).toBe('12/25/2024');
      });

      it('should format as DMY', () => {
        expect(formatDate(testDate, 'DMY')).toBe('25/12/2024');
      });

      it('should format as YMD', () => {
        expect(formatDate(testDate, 'YMD')).toBe('2024-12-25');
      });
    });

    describe('with string date', () => {
      it('should format string date as MDY', () => {
        expect(formatDate('2024-12-25', 'MDY')).toBe('12/25/2024');
      });

      it('should format string date as DMY', () => {
        expect(formatDate('2024-12-25', 'DMY')).toBe('25/12/2024');
      });

      it('should format string date as YMD', () => {
        expect(formatDate('2024-12-25', 'YMD')).toBe('2024-12-25');
      });
    });

    describe('edge cases', () => {
      it('should pad single digit days', () => {
        const date = new Date(2024, 0, 5); // January 5, 2024
        expect(formatDate(date, 'MDY')).toBe('01/05/2024');
        expect(formatDate(date, 'DMY')).toBe('05/01/2024');
        expect(formatDate(date, 'YMD')).toBe('2024-01-05');
      });

      it('should pad single digit months', () => {
        const date = new Date(2024, 2, 15); // March 15, 2024
        expect(formatDate(date, 'MDY')).toBe('03/15/2024');
      });

      it('should handle leap year date', () => {
        const date = new Date(2024, 1, 29); // February 29, 2024
        expect(formatDate(date, 'YMD')).toBe('2024-02-29');
      });

      it('should return Invalid Date for invalid string', () => {
        expect(formatDate('not-a-date', 'MDY')).toBe('Invalid Date');
      });

      it('should return Invalid Date for invalid Date object', () => {
        expect(formatDate(new Date('invalid'), 'MDY')).toBe('Invalid Date');
      });

      it('should handle first day of year', () => {
        const date = new Date(2024, 0, 1);
        expect(formatDate(date, 'YMD')).toBe('2024-01-01');
      });

      it('should handle last day of year', () => {
        const date = new Date(2024, 11, 31);
        expect(formatDate(date, 'YMD')).toBe('2024-12-31');
      });
    });
  });

  describe('getDateFormatLabel', () => {
    it('should return correct label for MDY', () => {
      expect(getDateFormatLabel('MDY')).toBe('MM/DD/YYYY');
    });

    it('should return correct label for DMY', () => {
      expect(getDateFormatLabel('DMY')).toBe('DD/MM/YYYY');
    });

    it('should return correct label for YMD', () => {
      expect(getDateFormatLabel('YMD')).toBe('YYYY-MM-DD');
    });

    it('should return default label for unknown format', () => {
      // TypeScript would prevent this, but testing runtime behavior
      expect(getDateFormatLabel('UNKNOWN' as 'MDY')).toBe('MM/DD/YYYY');
    });
  });

  describe('getDateFormatExample', () => {
    it('should return example for MDY', () => {
      expect(getDateFormatExample('MDY')).toBe('12/31/2024');
    });

    it('should return example for DMY', () => {
      expect(getDateFormatExample('DMY')).toBe('31/12/2024');
    });

    it('should return example for YMD', () => {
      expect(getDateFormatExample('YMD')).toBe('2024-12-31');
    });
  });

  describe('formatDateWithoutYear', () => {
    const testDate = new Date(1900, 2, 15); // March 15, 1900 (year unknown)

    describe('with Date object', () => {
      it('should format as "Month day" for MDY', () => {
        expect(formatDateWithoutYear(testDate, 'MDY')).toBe('March 15');
      });

      it('should format as "day Month" for DMY', () => {
        expect(formatDateWithoutYear(testDate, 'DMY')).toBe('15 March');
      });

      it('should format as "Month day" for YMD', () => {
        expect(formatDateWithoutYear(testDate, 'YMD')).toBe('March 15');
      });
    });

    describe('with string date', () => {
      it('should format string date for MDY', () => {
        expect(formatDateWithoutYear('1900-03-15', 'MDY')).toBe('March 15');
      });

      it('should format string date for DMY', () => {
        expect(formatDateWithoutYear('1900-03-15', 'DMY')).toBe('15 March');
      });

      it('should format string date for YMD', () => {
        expect(formatDateWithoutYear('1900-03-15', 'YMD')).toBe('March 15');
      });
    });

    describe('edge cases', () => {
      it('should handle single digit days', () => {
        const date = new Date(1900, 0, 5); // January 5
        expect(formatDateWithoutYear(date, 'MDY')).toBe('January 5');
        expect(formatDateWithoutYear(date, 'DMY')).toBe('5 January');
      });

      it('should handle all months correctly', () => {
        const months = [
          { date: new Date(1900, 0, 1), mdyExpected: 'January 1', dmyExpected: '1 January' },
          { date: new Date(1900, 1, 1), mdyExpected: 'February 1', dmyExpected: '1 February' },
          { date: new Date(1900, 2, 1), mdyExpected: 'March 1', dmyExpected: '1 March' },
          { date: new Date(1900, 11, 31), mdyExpected: 'December 31', dmyExpected: '31 December' },
        ];

        months.forEach(({ date, mdyExpected, dmyExpected }) => {
          expect(formatDateWithoutYear(date, 'MDY')).toBe(mdyExpected);
          expect(formatDateWithoutYear(date, 'DMY')).toBe(dmyExpected);
        });
      });

      it('should handle leap year date (Feb 29)', () => {
        const date = new Date(2024, 1, 29); // February 29 (2024 is a leap year)
        expect(formatDateWithoutYear(date, 'MDY')).toBe('February 29');
        expect(formatDateWithoutYear(date, 'DMY')).toBe('29 February');
      });

      it('should return Invalid Date for invalid string', () => {
        expect(formatDateWithoutYear('not-a-date', 'MDY')).toBe('Invalid Date');
      });

      it('should return Invalid Date for invalid Date object', () => {
        expect(formatDateWithoutYear(new Date('invalid'), 'MDY')).toBe('Invalid Date');
      });

      it('should work with any year, not just 1900', () => {
        const date = new Date(2024, 11, 25); // December 25, 2024
        expect(formatDateWithoutYear(date, 'MDY')).toBe('December 25');
        expect(formatDateWithoutYear(date, 'DMY')).toBe('25 December');
      });
    });
  });
});
