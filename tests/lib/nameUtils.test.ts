import { describe, it, expect } from 'vitest';
import { formatPersonName, formatFullName } from '@/lib/nameUtils';

describe('nameUtils', () => {
  describe('formatPersonName', () => {
    it('should format name only', () => {
      expect(formatPersonName('John')).toBe('John');
    });

    it('should format name and surname', () => {
      expect(formatPersonName('John', 'Smith')).toBe('John Smith');
    });

    it('should format name with nickname', () => {
      expect(formatPersonName('Charles', null, 'Charlie')).toBe("Charles 'Charlie'");
    });

    it('should format name, nickname, and surname', () => {
      expect(formatPersonName('Charles', 'Brown', 'Charlie')).toBe("Charles 'Charlie' Brown");
    });

    it('should handle null surname', () => {
      expect(formatPersonName('John', null)).toBe('John');
    });

    it('should handle undefined surname', () => {
      expect(formatPersonName('John', undefined)).toBe('John');
    });

    it('should handle null nickname', () => {
      expect(formatPersonName('John', 'Smith', null)).toBe('John Smith');
    });

    it('should handle undefined nickname', () => {
      expect(formatPersonName('John', 'Smith', undefined)).toBe('John Smith');
    });

    it('should handle all null/undefined optional params', () => {
      expect(formatPersonName('John', null, null)).toBe('John');
      expect(formatPersonName('John', undefined, undefined)).toBe('John');
    });

    it('should handle names with special characters', () => {
      expect(formatPersonName("Mary-Jane", "O'Connor", "MJ")).toBe("Mary-Jane 'MJ' O'Connor");
    });

    it('should handle unicode names', () => {
      expect(formatPersonName('José', 'García', 'Pepe')).toBe("José 'Pepe' García");
    });
  });

  describe('formatFullName', () => {
    it('should format person object with all fields', () => {
      const person = { name: 'John', surname: 'Doe', nickname: 'Johnny' };
      expect(formatFullName(person)).toBe("John 'Johnny' Doe");
    });

    it('should format person object with only name', () => {
      const person = { name: 'John' };
      expect(formatFullName(person)).toBe('John');
    });

    it('should format person object with name and surname', () => {
      const person = { name: 'John', surname: 'Doe' };
      expect(formatFullName(person)).toBe('John Doe');
    });

    it('should format person object with name and nickname', () => {
      const person = { name: 'John', nickname: 'Johnny' };
      expect(formatFullName(person)).toBe("John 'Johnny'");
    });

    it('should handle null values in person object', () => {
      const person = { name: 'John', surname: null, nickname: null };
      expect(formatFullName(person)).toBe('John');
    });
  });
});
