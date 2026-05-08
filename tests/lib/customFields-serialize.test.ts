import { describe, it, expect } from 'vitest';
import {
  customFieldXKey,
  buildCustomFieldXLines,
  filterFreeFormCustomFieldsAgainstTemplates,
} from '@/lib/customFields/serialize';

describe('customFieldXKey', () => {
  it('converts a hyphenated slug to the expected X-NAMETAG-FIELD-* key', () => {
    expect(customFieldXKey('dietary-restriction')).toBe('X-NAMETAG-FIELD-DIETARY-RESTRICTION');
  });

  it('handles a single-word slug', () => {
    expect(customFieldXKey('diet')).toBe('X-NAMETAG-FIELD-DIET');
  });

  it('uppercases already-uppercase slugs without doubling', () => {
    expect(customFieldXKey('DIET')).toBe('X-NAMETAG-FIELD-DIET');
  });
});

describe('buildCustomFieldXLines', () => {
  it('emits the correct XLine shape for a SELECT field', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'diet', type: 'SELECT', deletedAt: null },
        value: 'vegan',
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      key: 'X-NAMETAG-FIELD-DIET',
      params: { TYPE: 'NAMETAG-FIELD-SELECT' },
      value: 'vegan',
    });
  });

  it('emits the correct XLine shape for a BOOLEAN field', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'newsletter', type: 'BOOLEAN', deletedAt: null },
        value: 'true',
      },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({
      key: 'X-NAMETAG-FIELD-NEWSLETTER',
      params: { TYPE: 'NAMETAG-FIELD-BOOLEAN' },
      value: 'true',
    });
  });

  it('emits the correct XLine shape for a TEXT field', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'favourite-color', type: 'TEXT', deletedAt: null },
        value: 'blue',
      },
    ]);
    expect(lines[0].key).toBe('X-NAMETAG-FIELD-FAVOURITE-COLOR');
    expect(lines[0].params).toEqual({ TYPE: 'NAMETAG-FIELD-TEXT' });
    expect(lines[0].value).toBe('blue');
  });

  it('skips soft-deleted templates', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'old-field', type: 'TEXT', deletedAt: new Date() },
        value: 'some value',
      },
    ]);
    expect(lines).toHaveLength(0);
  });

  it('processes multiple inputs, skipping deleted ones', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'diet', type: 'SELECT', deletedAt: null },
        value: 'vegan',
      },
      {
        template: { slug: 'archived', type: 'TEXT', deletedAt: new Date('2024-01-01') },
        value: 'ignored',
      },
      {
        template: { slug: 'newsletter', type: 'BOOLEAN', deletedAt: null },
        value: 'false',
      },
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[0].key).toBe('X-NAMETAG-FIELD-DIET');
    expect(lines[1].key).toBe('X-NAMETAG-FIELD-NEWSLETTER');
  });

  it('returns empty array when given no inputs', () => {
    expect(buildCustomFieldXLines([])).toEqual([]);
  });
});

describe('filterFreeFormCustomFieldsAgainstTemplates', () => {
  it('removes free-form entries whose key is in the blocked list', () => {
    const freeForm = [
      { key: 'X-NAMETAG-FIELD-DIET', value: 'omnivore' },
      { key: 'X-CUSTOM-OTHER', value: 'keep me' },
    ];
    const result = filterFreeFormCustomFieldsAgainstTemplates(freeForm, [
      'X-NAMETAG-FIELD-DIET',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('X-CUSTOM-OTHER');
  });

  it('keeps all entries when blocked list is empty', () => {
    const freeForm = [
      { key: 'X-FOO', value: 'foo' },
      { key: 'X-BAR', value: 'bar' },
    ];
    const result = filterFreeFormCustomFieldsAgainstTemplates(freeForm, []);
    expect(result).toHaveLength(2);
  });

  it('removes all entries when all are blocked', () => {
    const freeForm = [
      { key: 'X-A', value: '1' },
      { key: 'X-B', value: '2' },
    ];
    const result = filterFreeFormCustomFieldsAgainstTemplates(freeForm, ['X-A', 'X-B']);
    expect(result).toHaveLength(0);
  });

  it('does not remove entries with unrelated keys', () => {
    const freeForm = [
      { key: 'X-UNRELATED', value: 'something' },
      { key: 'X-NAMETAG-FIELD-OTHER', value: 'other' },
    ];
    const result = filterFreeFormCustomFieldsAgainstTemplates(freeForm, [
      'X-NAMETAG-FIELD-DIET',
    ]);
    expect(result).toHaveLength(2);
  });

  it('works with additional properties on the free-form object', () => {
    const freeForm = [
      { key: 'X-BLOCKED', value: 'v1', extra: 'data' },
      { key: 'X-KEEP', value: 'v2', extra: 'more' },
    ];
    const result = filterFreeFormCustomFieldsAgainstTemplates(freeForm, ['X-BLOCKED']);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ key: 'X-KEEP', value: 'v2', extra: 'more' });
  });
});
