import { describe, it, expect } from 'vitest';
import {
  parseOperand,
  serializeOperand,
  readReference,
} from '@/lib/relationship-labels/operand';
import type { PersonLabelContext } from '@/lib/relationship-labels/types';

function ctx(overrides: Partial<PersonLabelContext> = {}): PersonLabelContext {
  return {
    fields: { nickname: 'Coco', surname: null },
    groupIds: new Set(['group-1']),
    customValues: new Map([['tpl-1', { type: 'SELECT' as const, value: 'Rouge' }]]),
    dates: [
      { type: 'birthday', title: 'Anniversaire', date: new Date(1985, 10, 2) },
      { type: null, title: 'Mariage', date: new Date(2015, 5, 20) },
      { type: null, title: 'Mariage', date: new Date(2001, 0, 5) },
    ],
    ...overrides,
  };
}

describe('parseOperand', () => {
  it('reads a literal', () => {
    expect(parseOperand('lit:Coco')).toEqual({ kind: 'literal', value: 'Coco' });
  });

  it('keeps a literal that itself looks like a prefix', () => {
    expect(parseOperand('lit:ref:nickname')).toEqual({ kind: 'literal', value: 'ref:nickname' });
  });

  it('reads the current instant', () => {
    expect(parseOperand('now')).toEqual({ kind: 'now' });
  });

  it('reads a reference', () => {
    expect(parseOperand('ref:birthday')).toEqual({ kind: 'ref', ref: 'birthday' });
  });

  it('returns null for an absent operand', () => {
    expect(parseOperand(null)).toBeNull();
  });

  it('returns null for an unprefixed value rather than throwing', () => {
    expect(parseOperand('Coco')).toBeNull();
  });

  it('returns null for an empty reference', () => {
    expect(parseOperand('ref:')).toBeNull();
  });
});

describe('serializeOperand', () => {
  it('round-trips every form', () => {
    const forms = [
      { kind: 'literal' as const, value: 'ref:nickname' },
      { kind: 'now' as const },
      { kind: 'ref' as const, ref: 'birthday' },
    ];
    for (const form of forms) {
      expect(parseOperand(serializeOperand(form))).toEqual(form);
    }
  });
});

describe('readReference', () => {
  it('reads a native field', () => {
    expect(readReference(ctx(), 'PERSON_FIELD', 'nickname')).toEqual({ kind: 'text', value: 'Coco' });
  });

  it('returns null for a native field with no value', () => {
    expect(readReference(ctx(), 'PERSON_FIELD', 'surname')).toBeNull();
  });

  it('returns null for a field outside the allowed list', () => {
    expect(readReference(ctx(), 'PERSON_FIELD', 'notes')).toBeNull();
  });

  it('reads group membership as present', () => {
    expect(readReference(ctx(), 'GROUP', 'group-1')).toEqual({ kind: 'group', present: true });
  });

  it('reads group non-membership as absent membership, not as no value', () => {
    expect(readReference(ctx(), 'GROUP', 'group-9')).toEqual({ kind: 'group', present: false });
  });

  it('reads a custom field value with its type', () => {
    expect(readReference(ctx(), 'CUSTOM_FIELD', 'tpl-1')).toEqual({
      kind: 'custom',
      type: 'SELECT',
      value: 'Rouge',
    });
  });

  it('returns null for a custom field the person has no value for', () => {
    expect(readReference(ctx(), 'CUSTOM_FIELD', 'tpl-9')).toBeNull();
  });

  it('reads a predefined date by type', () => {
    expect(readReference(ctx(), 'DATE_TYPE', 'birthday')).toEqual({
      kind: 'date',
      value: new Date(1985, 10, 2),
    });
  });

  it('takes the earliest date when several share a title', () => {
    expect(readReference(ctx(), 'DATE_TITLE', 'Mariage')).toEqual({
      kind: 'date',
      value: new Date(2001, 0, 5),
    });
  });

  it('matches a date title case and whitespace insensitively', () => {
    expect(readReference(ctx(), 'DATE_TITLE', '  mariage ')).toEqual({
      kind: 'date',
      value: new Date(2001, 0, 5),
    });
  });

  it('returns null for a date the person does not have', () => {
    expect(readReference(ctx(), 'DATE_TYPE', 'memorial')).toBeNull();
  });
});
