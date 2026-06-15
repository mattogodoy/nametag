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

function person(overrides: Partial<PersonForComparison> & { id: string; name: string }): PersonForComparison {
  return {
    surname: null,
    emails: [],
    phones: [],
    birthdays: [],
    ...overrides,
  };
}

describe('findDuplicates (multi-signal)', () => {
  it('does not flag "John Abc" vs "John Def" as duplicates (issue #306)', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'John', surname: 'Abc' }),
      person({ id: '2', name: 'John', surname: 'Def' }),
    ];
    const results = findDuplicates(people[0], people, people[0].id);
    expect(results).toHaveLength(0);
  });

  it('flags exact email match as duplicate regardless of name', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'Alice', surname: 'Wonderland', emails: ['alice@test.com'] }),
      person({ id: '2', name: 'Alicia', surname: 'Wonder', emails: ['alice@test.com'] }),
    ];
    const results = findDuplicates(people[0], people, people[0].id);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBeGreaterThanOrEqual(0.85);
  });

  it('flags accented name variants when name-only (near-exact bypass)', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'María', surname: 'García' }),
      person({ id: '2', name: 'Maria', surname: 'Garcia' }),
    ];
    const results = findDuplicates(people[0], people, people[0].id);
    expect(results).toHaveLength(1);
  });

  it('detects accented name variants when email also matches', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'María', surname: 'García', emails: ['maria@test.com'] }),
      person({ id: '2', name: 'Maria', surname: 'Garcia', emails: ['maria@test.com'] }),
    ];
    const results = findDuplicates(people[0], people, people[0].id);
    expect(results).toHaveLength(1);
  });
});

describe('findAllDuplicateGroups (multi-signal)', () => {
  it('does not group people with same first name but different surnames when name-only', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'John', surname: 'Abc' }),
      person({ id: '2', name: 'John', surname: 'Def' }),
      person({ id: '3', name: 'Jane', surname: 'Smith' }),
    ];
    const groups = findAllDuplicateGroups(people);
    expect(groups).toHaveLength(0);
  });

  it('groups people sharing an email', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'Bob', surname: 'A', emails: ['bob@test.com'] }),
      person({ id: '2', name: 'Robert', surname: 'B', emails: ['bob@test.com'] }),
      person({ id: '3', name: 'Charlie', surname: 'C' }),
    ];
    const groups = findAllDuplicateGroups(people);
    expect(groups).toHaveLength(1);
    expect(groups[0].people).toHaveLength(2);
  });

  it('respects dismissed pairs', () => {
    const people: PersonForComparison[] = [
      person({ id: '1', name: 'Bob', surname: 'A', emails: ['bob@test.com'] }),
      person({ id: '2', name: 'Robert', surname: 'B', emails: ['bob@test.com'] }),
    ];
    const dismissed = new Set(['1:2']);
    const groups = findAllDuplicateGroups(people, dismissed);
    expect(groups).toHaveLength(0);
  });
});

describe('compositeSimilarity', () => {
  it('caps name-only matches at sparsity cap (issue #306)', () => {
    const a = person({ id: '1', name: 'John', surname: 'Abc' });
    const b = person({ id: '2', name: 'John', surname: 'Def' });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeLessThanOrEqual(0.6);
    expect(result.autoFlagged).toBe(false);
  });

  it('bypasses sparsity cap for near-exact name-only matches', () => {
    const a = person({ id: '1', name: 'Maria', surname: 'Garcia' });
    const b = person({ id: '2', name: 'María', surname: 'García' });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBe(1.0);
  });

  it('still caps weak name-only matches at sparsity cap', () => {
    const a = person({ id: '1', name: 'John', surname: 'Smith' });
    const b = person({ id: '2', name: 'Jon', surname: 'Smyth' });
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

  it('does not auto-flag on phone match alone', () => {
    const a = person({ id: '1', name: 'Jane', surname: 'Doe', phones: ['5551234567'] });
    const b = person({ id: '2', name: 'Janet', surname: 'Do', phones: ['5551234567'] });
    const result = compositeSimilarity(a, b);
    expect(result.autoFlagged).toBe(false);
  });

  it('uses phone as a composite signal to boost score', () => {
    const withPhone = person({ id: '1', name: 'Jane', surname: 'Doe', phones: ['5551234567'] });
    const withPhone2 = person({ id: '2', name: 'Jane', surname: 'Doe', phones: ['5551234567'] });
    const noPhone = person({ id: '3', name: 'Jane', surname: 'Doe' });
    const noPhone2 = person({ id: '4', name: 'Jane', surname: 'Doe' });
    const withPhoneResult = compositeSimilarity(withPhone, withPhone2);
    const noPhoneResult = compositeSimilarity(noPhone, noPhone2);
    expect(withPhoneResult.score).toBeGreaterThanOrEqual(noPhoneResult.score);
  });

  it('scores birthday exact match', () => {
    const bday = new Date('1990-05-15');
    const a = person({ id: '1', name: 'John', surname: 'Smith', birthdays: [bday] });
    const b = person({ id: '2', name: 'John', surname: 'Smith', birthdays: [bday] });
    const result = compositeSimilarity(a, b);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('scores birthday same month+day different year as 0.5', () => {
    const a = person({ id: '1', name: 'Roberto', surname: 'Sanchez', birthdays: [new Date('1990-05-15')] });
    const b = person({ id: '2', name: 'Robert', surname: 'Sanchez', birthdays: [new Date('1985-05-15')] });
    const resultSameDay = compositeSimilarity(a, b);
    const c = person({ id: '3', name: 'Robert', surname: 'Sanchez', birthdays: [new Date('1990-08-20')] });
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
    const b = person({ id: '2', name: 'John', surname: 'Smith', birthdays: [new Date('1985-05-15')] });
    const result = compositeSimilarity(a, b);
    // Name=1.0, Birthday=0.5 (same month+day, different year)
    // Weighted: (0.4/0.5)*1.0 + (0.1/0.5)*0.5 = 0.9
    // Without sparsity bypass this would be capped at 0.6
    expect(result.score).toBeGreaterThan(0.6);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});
