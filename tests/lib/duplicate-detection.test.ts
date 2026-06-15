import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  findDuplicates,
  findAllDuplicateGroups,
} from '@/lib/duplicate-detection';

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  John@Example.COM  ')).toBe('john@example.com');
  });
});

describe('normalizePhone', () => {
  it('strips non-digits and keeps last 10', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('5551234567');
  });

  it('keeps short numbers as-is', () => {
    expect(normalizePhone('12345')).toBe('12345');
  });

  it('handles a number with exactly 10 digits', () => {
    expect(normalizePhone('555-123-4567')).toBe('5551234567');
  });
});

describe('duplicate-detection with accents', () => {
  const makePerson = (id: string, name: string, surname: string | null) => ({
    id,
    name,
    surname,
    emails: [] as string[],
    phones: [] as string[],
    birthdays: [] as Date[],
  });

  it('should detect accented and unaccented names as duplicates', () => {
    const people = [
      makePerson('1', 'María', 'García'),
      makePerson('2', 'Maria', 'Garcia'),
    ];

    const duplicates = findDuplicates('María', 'García', people, '1');
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].personId).toBe('2');
    expect(duplicates[0].similarity).toBe(1);
  });

  it('should group accented variants together', () => {
    const people = [
      makePerson('1', 'María', 'García'),
      makePerson('2', 'Maria', 'Garcia'),
      makePerson('3', 'John', 'Smith'),
    ];

    const groups = findAllDuplicateGroups(people);
    expect(groups).toHaveLength(1);
    expect(groups[0].people).toHaveLength(2);
    expect(groups[0].similarity).toBe(1);
  });
});
