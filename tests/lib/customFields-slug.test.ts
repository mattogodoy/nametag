import { describe, it, expect } from 'vitest';
import { deriveSlug } from '../../lib/customFields/slug';

describe('deriveSlug', () => {
  it('lowercases and dasherizes basic words', () => {
    expect(deriveSlug('Dietary Restriction')).toBe('dietary-restriction');
  });

  it('trims and collapses whitespace', () => {
    expect(deriveSlug('   Has   Pets   ')).toBe('has-pets');
  });

  it('strips diacritics', () => {
    expect(deriveSlug('Préférence')).toBe('preference');
  });

  it('removes punctuation', () => {
    expect(deriveSlug("Person's hobby!?")).toBe('persons-hobby');
  });

  it('keeps numbers', () => {
    expect(deriveSlug('Hobby 1')).toBe('hobby-1');
  });

  it('returns empty string for input with no slug-able chars', () => {
    expect(deriveSlug('???')).toBe('');
  });
});
