import { describe, it, expect } from 'vitest';
import { findLabelWarnings } from '@/lib/relationship-labels/warnings';
import type { LabelCondition, LabelVariant } from '@/lib/relationship-labels/types';

const known = { groupIds: ['g1'], templateIds: ['tpl-1'] };

function cond(overrides: Partial<LabelCondition>): LabelCondition {
  return {
    subject: 'DESCRIBED',
    source: 'PERSON_FIELD',
    subjectRef: 'gender',
    operator: 'IS',
    operand: 'lit:Homme',
    ...overrides,
  };
}

describe('findLabelWarnings', () => {
  it('reports nothing on a sound configuration', () => {
    const variants: LabelVariant[] = [
      { label: 'frere', conditions: [cond({})] },
      { label: 'fratrie', conditions: [] },
    ];
    expect(findLabelWarnings(variants, known)).toEqual([]);
  });

  it('flags a variant placed after the fallback', () => {
    const variants: LabelVariant[] = [
      { label: 'fratrie', conditions: [] },
      { label: 'frere', conditions: [cond({})] },
    ];
    expect(findLabelWarnings(variants, known)).toContainEqual({
      variantIndex: 1,
      conditionIndex: null,
      code: 'UNREACHABLE_AFTER_FALLBACK',
    });
  });

  it('flags a variant that exactly duplicates an earlier one', () => {
    const variants: LabelVariant[] = [
      { label: 'frere', conditions: [cond({})] },
      { label: 'frangin', conditions: [cond({})] },
    ];
    expect(findLabelWarnings(variants, known)).toContainEqual({
      variantIndex: 1,
      conditionIndex: null,
      code: 'DUPLICATE_VARIANT',
    });
  });

  it('flags a birth date compared to the current instant as always true', () => {
    const variants: LabelVariant[] = [
      {
        label: 'x',
        conditions: [
          cond({ source: 'DATE_TYPE', subjectRef: 'birthday', operator: 'BEFORE', operand: 'now' }),
        ],
      },
    ];
    expect(findLabelWarnings(variants, known)).toContainEqual({
      variantIndex: 0,
      conditionIndex: 0,
      code: 'ALWAYS_TRUE',
    });
  });

  it('flags a reference to a group the user no longer has', () => {
    const variants: LabelVariant[] = [
      {
        label: 'x',
        conditions: [cond({ source: 'GROUP', subjectRef: 'gone', operator: 'IN_GROUP', operand: null })],
      },
    ];
    expect(findLabelWarnings(variants, known)).toContainEqual({
      variantIndex: 0,
      conditionIndex: 0,
      code: 'BROKEN_REFERENCE',
    });
  });

  it('flags a reference to a deleted custom field', () => {
    const variants: LabelVariant[] = [
      {
        label: 'x',
        conditions: [cond({ source: 'CUSTOM_FIELD', subjectRef: 'tpl-gone', operator: 'IS_SET', operand: null })],
      },
    ];
    expect(findLabelWarnings(variants, known)).toContainEqual({
      variantIndex: 0,
      conditionIndex: 0,
      code: 'BROKEN_REFERENCE',
    });
  });
});
