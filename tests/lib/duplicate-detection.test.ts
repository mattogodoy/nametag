import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  findDuplicates,
  findAllDuplicateGroups,
  compositeSimilarity,
} from '@/lib/duplicate-detection';
import type { PersonForComparison } from '@/lib/duplicate-detection';

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

function person(overrides: Partial<PersonForComparison> & { id: string; name: string }): PersonForComparison {
  return {
    surname: null,
    emails: [],
    phones: [],
    birthdays: [],
    ...overrides,
  };
}

describe('compositeSimilarity', () => {
  it('caps name-only matches at sparsity cap (issue #306)', () => {
    const a = person({ id: '1', name: 'John', surname: 'Abc' });
    const b = person({ id: '2', name: 'John', surname: 'Def' });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeLessThanOrEqual(0.6);
    expect(result.autoFlagged).toBe(false);
  });

  it('scores accented name variants high when name-only', () => {
    const a = person({ id: '1', name: 'Maria', surname: 'Garcia' });
    const b = person({ id: '2', name: 'María', surname: 'García' });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeLessThanOrEqual(0.6);
  });

  it('gives full score when name + email both match', () => {
    const a = person({ id: '1', name: 'John', surname: 'Smith', emails: ['john@test.com'] });
    const b = person({ id: '2', name: 'John', surname: 'Smith', emails: ['john@test.com'] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThanOrEqual(0.9);
    expect(result.autoFlagged).toBe(true);
  });

  it('auto-flags on email match even with different names', () => {
    const a = person({ id: '1', name: 'Jonathan', surname: 'Smith', emails: ['js@test.com'] });
    const b = person({ id: '2', name: 'Johnny', surname: 'Smyth', emails: ['js@test.com'] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.autoFlagged).toBe(true);
  });

  it('auto-flags on phone match even with different names', () => {
    const a = person({ id: '1', name: 'Jane', surname: 'Doe', phones: ['5551234567'] });
    const b = person({ id: '2', name: 'Janet', surname: 'Do', phones: ['5551234567'] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.autoFlagged).toBe(true);
  });

  it('scores birthday exact match', () => {
    const bday = new Date('1990-05-15');
    const a = person({ id: '1', name: 'John', surname: 'Smith', birthdays: [bday] });
    const b = person({ id: '2', name: 'John', surname: 'Smith', birthdays: [bday] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('scores birthday same month+day different year as 0.5', () => {
    const a = person({ id: '1', name: 'John', surname: 'Smith', birthdays: [new Date('1990-05-15')] });
    const b = person({ id: '2', name: 'John', surname: 'Smith', birthdays: [new Date('1985-05-15')] });
    const resultSameDay = compositeSimilarity(a, b);
    const c = person({ id: '3', name: 'John', surname: 'Smith', birthdays: [new Date('1990-08-20')] });
    const resultDiffDay = compositeSimilarity(a, c);
    expect(resultSameDay.score).toBeGreaterThan(resultDiffDay.score);
  });

  it('penalizes score when comparable signal does not match', () => {
    const nameOnly = person({ id: '1', name: 'John', surname: 'Smith' });
    const nameOnly2 = person({ id: '2', name: 'John', surname: 'Smith' });
    const withDiffEmail = person({ id: '3', name: 'John', surname: 'Smith', emails: ['a@test.com'] });
    const withDiffEmail2 = person({ id: '4', name: 'John', surname: 'Smith', emails: ['b@test.com'] });

    const nameOnlyResult = compositeSimilarity(nameOnly, nameOnly2);
    const diffEmailResult = compositeSimilarity(withDiffEmail, withDiffEmail2);
    expect(diffEmailResult.score).toBeLessThan(nameOnlyResult.score);
  });

  it('does not apply sparsity cap when 2+ signals are comparable', () => {
    const a = person({ id: '1', name: 'John', surname: 'Smith', birthdays: [new Date('1990-05-15')] });
    const b = person({ id: '2', name: 'John', surname: 'Smith', birthdays: [new Date('1990-05-15')] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThan(0.6);
  });
});
