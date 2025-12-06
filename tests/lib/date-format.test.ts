import { describe, it, expect } from 'vitest';
import { formatDate, getDateFormatLabel, getDateFormatExample } from '@/lib/date-format';

describe('date-format', () => {
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
});
