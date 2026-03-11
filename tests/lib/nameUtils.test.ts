import { describe, it, expect } from 'vitest';
import { formatPersonName, formatFullName, formatGraphName } from '@/lib/nameUtils';

describe('nameUtils', () => {
  describe('formatPersonName', () => {
    it('should format name only', () => {
      expect(formatPersonName('John')).toBe('John');
    });

    it('should format name and surname', () => {
      expect(formatPersonName('John', 'Smith')).toBe('John Smith');
    });

    it('should format name with nickname', () => {
      expect(formatPersonName('Charles', null, null, null, 'Charlie')).toBe("Charles 'Charlie'");
    });

    it('should format name, nickname, and surname', () => {
      expect(formatPersonName('Charles', 'Brown', null, null, 'Charlie')).toBe("Charles 'Charlie' Brown");
    });

    it('should handle null surname', () => {
      expect(formatPersonName('John', null)).toBe('John');
    });

    it('should handle undefined surname', () => {
      expect(formatPersonName('John', undefined)).toBe('John');
    });

    it('should handle null nickname', () => {
      expect(formatPersonName('John', 'Smith', null, null, null)).toBe('John Smith');
    });

    it('should handle undefined nickname', () => {
      expect(formatPersonName('John', 'Smith', undefined, undefined, undefined)).toBe('John Smith');
    });

    it('should handle all null/undefined optional params', () => {
      expect(formatPersonName('John', null, null)).toBe('John');
      expect(formatPersonName('John', undefined, undefined)).toBe('John');
    });

    it('should handle names with special characters', () => {
      expect(formatPersonName("Mary-Jane", "O'Connor", null, null, "MJ")).toBe("Mary-Jane 'MJ' O'Connor");
    });

    it('should handle unicode names', () => {
      expect(formatPersonName('José', 'García', null, null, 'Pepe')).toBe("José 'Pepe' García");
    });

    it('should format name with middle name', () => {
      expect(formatPersonName('John', 'Doe', 'Michael')).toBe('John Michael Doe');
    });

    it('should format name with second last name', () => {
      expect(formatPersonName('Jane', 'Smith', null, 'Johnson')).toBe('Jane Smith Johnson');
    });

    it('should format name with middle name and second last name', () => {
      expect(formatPersonName('Matias', 'Godoy', 'Alejandro', 'Biedma')).toBe('Matias Alejandro Godoy Biedma');
    });

    it('should format complete name with nickname, middle name, and second last name', () => {
      expect(formatPersonName('Matias', 'Godoy', 'Alejandro', 'Biedma', 'Matto')).toBe("Matias 'Matto' Alejandro Godoy Biedma");
    });

    it('should handle null middle name and second last name', () => {
      expect(formatPersonName('John', 'Doe', null, null)).toBe('John Doe');
    });

    it('should handle undefined middle name and second last name', () => {
      expect(formatPersonName('John', 'Doe', undefined, undefined)).toBe('John Doe');
    });
  });

  describe('formatFullName', () => {
    it('should use FULLNAME_FORMAT when person.nameFormat is not provided', () => {
      process.env.FULLNAME_FORMAT = '{surname}, {name}';
      const person = { name: 'John', surname: 'Doe' };
      expect(formatFullName(person)).toBe('Doe, John');
      delete process.env.FULLNAME_FORMAT;
    });

    it('should prioritize person.nameFormat over FULLNAME_FORMAT', () => {
      process.env.FULLNAME_FORMAT = '{surname}, {name}';
      const person = { name: 'John', surname: 'Doe', nameFormat: '{name} ({surname})' };
      expect(formatFullName(person)).toBe('John (Doe)');
      delete process.env.FULLNAME_FORMAT;
    });

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

    it('should format person with middle name', () => {
      const person = { name: 'John', surname: 'Doe', middleName: 'Michael' };
      expect(formatFullName(person)).toBe('John Michael Doe');
    });

    it('should format person with second last name', () => {
      const person = { name: 'Jane', surname: 'Smith', secondLastName: 'Johnson' };
      expect(formatFullName(person)).toBe('Jane Smith Johnson');
    });

    it('should format person with all name fields', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
        nickname: 'Matto'
      };
      expect(formatFullName(person)).toBe("Matias 'Matto' Alejandro Godoy Biedma");
    });
  });

  describe('formatGraphName', () => {
    it('should use GRAPHNAME_FORMAT for graph labels', () => {
      process.env.GRAPHNAME_FORMAT = '{surname}, {name}';
      const person = { name: 'John', surname: 'Doe' };
      expect(formatGraphName(person)).toBe('Doe, John');
      delete process.env.GRAPHNAME_FORMAT;
    });

    it('should allow nickname placeholder in GRAPHNAME_FORMAT', () => {
      process.env.GRAPHNAME_FORMAT = '{surname}, {nickname}';
      const person = { name: 'Matias', surname: 'Godoy', nickname: 'Matto' };
      expect(formatGraphName(person)).toBe('Godoy, Matto');
      delete process.env.GRAPHNAME_FORMAT;
    });

    it('should fallback to default logic when GRAPHNAME_FORMAT is empty', () => {
      process.env.GRAPHNAME_FORMAT = '';
      const person = { name: 'Matias', surname: 'Godoy', nickname: 'Matto' };
      expect(formatGraphName(person)).toBe('Matto Godoy');
      delete process.env.GRAPHNAME_FORMAT;
    });

    it('should format name only', () => {
      const person = { name: 'John' };
      expect(formatGraphName(person)).toBe('John');
    });

    it('should format name and surname', () => {
      const person = { name: 'John', surname: 'Doe' };
      expect(formatGraphName(person)).toBe('John Doe');
    });

    it('should use nickname instead of name when present', () => {
      const person = { name: 'Matias', surname: 'Godoy', nickname: 'Matto' };
      expect(formatGraphName(person)).toBe('Matto Godoy');
    });

    it('should show only first name and surname (ignore middle names)', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
      };
      expect(formatGraphName(person)).toBe('Matias Godoy');
    });

    it('should use nickname with surname (ignore middle names)', () => {
      const person = {
        name: 'Matias',
        surname: 'Godoy',
        middleName: 'Alejandro',
        secondLastName: 'Biedma',
        nickname: 'Matto',
      };
      expect(formatGraphName(person)).toBe('Matto Godoy');
    });

    it('should handle null surname', () => {
      const person = { name: 'John', surname: null };
      expect(formatGraphName(person)).toBe('John');
    });

    it('should handle nickname without surname', () => {
      const person = { name: 'John', surname: null, nickname: 'Johnny' };
      expect(formatGraphName(person)).toBe('Johnny');
    });
  });
});
