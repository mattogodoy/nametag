import { describe, it, expect } from 'vitest';
import { evaluateCondition, resolveLabel } from '@/lib/relationship-labels/resolver';
import type {
  LabelCondition,
  LabelVariant,
  PersonLabelContext,
} from '@/lib/relationship-labels/types';
import { EMPTY_PERSON_CONTEXT } from '@/lib/relationship-labels/types';

const NOW = new Date(2026, 7, 27);

function person(overrides: Partial<PersonLabelContext> = {}): PersonLabelContext {
  return { ...EMPTY_PERSON_CONTEXT, ...overrides };
}

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

const male = person({ fields: { gender: 'Homme' } });
const female = person({ fields: { gender: 'Femme' } });
const unknownGender = person({ fields: {} });

describe('evaluateCondition: text', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    const subject = person({ fields: { gender: '  homme ' } });
    expect(evaluateCondition(cond({}), subject, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('is false when the value is absent', () => {
    expect(evaluateCondition(cond({}), unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('does not match absence with IS_NOT', () => {
    const c = cond({ operator: 'IS_NOT' });
    expect(evaluateCondition(c, unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
    expect(evaluateCondition(c, female, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('does not match absence with NOT_CONTAINS', () => {
    const c = cond({ operator: 'NOT_CONTAINS', operand: 'lit:om' });
    expect(evaluateCondition(c, unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
    expect(evaluateCondition(c, female, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
    expect(evaluateCondition(c, male, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('matches absence only with IS_NOT_SET', () => {
    const c = cond({ operator: 'IS_NOT_SET', operand: null });
    expect(evaluateCondition(c, unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
    expect(evaluateCondition(c, male, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('reads the other person when the subject says so', () => {
    const c = cond({ subject: 'OTHER' });
    expect(evaluateCondition(c, female, male, NOW)).toBe(true);
  });
});

describe('evaluateCondition: groups', () => {
  const inGroup = person({ groupIds: new Set(['g1']) });

  it('is true when the person belongs', () => {
    const c = cond({ source: 'GROUP', subjectRef: 'g1', operator: 'IN_GROUP', operand: null });
    expect(evaluateCondition(c, inGroup, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('treats non-membership as a false membership, not as absence', () => {
    const c = cond({ source: 'GROUP', subjectRef: 'g1', operator: 'NOT_IN_GROUP', operand: null });
    expect(evaluateCondition(c, EMPTY_PERSON_CONTEXT, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
    expect(evaluateCondition(c, inGroup, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });
});

describe('evaluateCondition: custom fields', () => {
  const withNumber = person({
    customValues: new Map([['tpl', { type: 'NUMBER' as const, value: '42' }]]),
  });
  const withJunk = person({
    customValues: new Map([['tpl', { type: 'NUMBER' as const, value: 'douze' }]]),
  });
  const withBool = person({
    customValues: new Map([['tpl', { type: 'BOOLEAN' as const, value: 'true' }]]),
  });

  it('compares numbers', () => {
    const c = cond({ source: 'CUSTOM_FIELD', subjectRef: 'tpl', operator: 'GT', operand: 'lit:40' });
    expect(evaluateCondition(c, withNumber, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('is false rather than raising on a non-convertible number', () => {
    const c = cond({ source: 'CUSTOM_FIELD', subjectRef: 'tpl', operator: 'GT', operand: 'lit:40' });
    expect(evaluateCondition(c, withJunk, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('evaluates booleans', () => {
    const c = cond({ source: 'CUSTOM_FIELD', subjectRef: 'tpl', operator: 'IS_TRUE', operand: null });
    expect(evaluateCondition(c, withBool, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });
});

describe('evaluateCondition: dates', () => {
  const past = person({
    dates: [{ type: 'memorial', title: 'Deces', date: new Date(2021, 3, 17) }],
  });
  const today = person({
    dates: [{ type: 'memorial', title: 'Deces', date: new Date(2026, 7, 27, 18, 30) }],
  });
  const future = person({
    dates: [{ type: 'anniversary', title: 'Mariage', date: new Date(2027, 8, 4) }],
  });

  it('compares strictly before the current instant', () => {
    const c = cond({ source: 'DATE_TYPE', subjectRef: 'memorial', operator: 'BEFORE', operand: 'now' });
    expect(evaluateCondition(c, past, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
    expect(evaluateCondition(c, today, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('includes the day itself with ON_OR_BEFORE', () => {
    const c = cond({ source: 'DATE_TYPE', subjectRef: 'memorial', operator: 'ON_OR_BEFORE', operand: 'now' });
    expect(evaluateCondition(c, today, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('compares at day granularity, ignoring the time of day', () => {
    const c = cond({ source: 'DATE_TYPE', subjectRef: 'memorial', operator: 'SAME_DAY', operand: 'now' });
    expect(evaluateCondition(c, today, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('is false for an absent date, both for past and for future tests', () => {
    const before = cond({ source: 'DATE_TYPE', subjectRef: 'memorial', operator: 'BEFORE', operand: 'now' });
    const after = cond({ source: 'DATE_TYPE', subjectRef: 'memorial', operator: 'AFTER', operand: 'now' });
    expect(evaluateCondition(before, EMPTY_PERSON_CONTEXT, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
    expect(evaluateCondition(after, EMPTY_PERSON_CONTEXT, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('compares the stored date, never its yearly occurrence', () => {
    const c = cond({ source: 'DATE_TYPE', subjectRef: 'anniversary', operator: 'AFTER', operand: 'now' });
    expect(evaluateCondition(c, future, EMPTY_PERSON_CONTEXT, NOW)).toBe(true);
  });

  it('compares against the other person for a cross-person reference', () => {
    const elder = person({ dates: [{ type: 'birthday', title: 'N', date: new Date(1985, 10, 2) }] });
    const younger = person({ dates: [{ type: 'birthday', title: 'N', date: new Date(1996, 1, 14) }] });
    const c = cond({
      source: 'DATE_TYPE',
      subjectRef: 'birthday',
      operator: 'BEFORE',
      operand: 'ref:birthday',
    });
    expect(evaluateCondition(c, elder, younger, NOW)).toBe(true);
    expect(evaluateCondition(c, younger, elder, NOW)).toBe(false);
  });

  it('is false when either side of a cross-person comparison is absent', () => {
    const elder = person({ dates: [{ type: 'birthday', title: 'N', date: new Date(1985, 10, 2) }] });
    const c = cond({
      source: 'DATE_TYPE',
      subjectRef: 'birthday',
      operator: 'BEFORE',
      operand: 'ref:birthday',
    });
    expect(evaluateCondition(c, elder, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });
});

describe('evaluateCondition: malformed configuration', () => {
  it('is false when the operator needs an operand and none is readable', () => {
    const c = cond({ operand: 'Homme' });
    expect(evaluateCondition(c, male, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });

  it('is false when the operator does not fit the data kind', () => {
    const c = cond({ source: 'GROUP', subjectRef: 'g1', operator: 'CONTAINS', operand: 'lit:x' });
    expect(evaluateCondition(c, EMPTY_PERSON_CONTEXT, EMPTY_PERSON_CONTEXT, NOW)).toBe(false);
  });
});

describe('resolveLabel', () => {
  const variants: LabelVariant[] = [
    { label: 'frere', conditions: [cond({})] },
    { label: 'soeur', conditions: [cond({ operand: 'lit:Femme' })] },
    { label: 'fratrie', conditions: [] },
  ];

  it('returns the first variant whose conditions all hold', () => {
    expect(resolveLabel(variants, 'Frere/Soeur', male, EMPTY_PERSON_CONTEXT, NOW)).toEqual({
      label: 'frere',
      variantIndex: 0,
    });
  });

  it('falls through to the explicit fallback', () => {
    expect(resolveLabel(variants, 'Frere/Soeur', unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toEqual({
      label: 'fratrie',
      variantIndex: 2,
    });
  });

  it('synthesises a fallback from the type label when none is explicit', () => {
    const withoutFallback = variants.slice(0, 2);
    expect(resolveLabel(withoutFallback, 'Frere/Soeur', unknownGender, EMPTY_PERSON_CONTEXT, NOW)).toEqual({
      label: 'Frere/Soeur',
      variantIndex: null,
    });
  });

  it('returns the type label unchanged when there are no variants at all', () => {
    expect(resolveLabel([], 'Ami', male, EMPTY_PERSON_CONTEXT, NOW)).toEqual({
      label: 'Ami',
      variantIndex: null,
    });
  });

  it('requires every condition of a variant to hold', () => {
    const widow: LabelVariant[] = [
      {
        label: 'veuve',
        conditions: [
          cond({
            subject: 'OTHER',
            source: 'DATE_TYPE',
            subjectRef: 'memorial',
            operator: 'BEFORE',
            operand: 'now',
          }),
          cond({ operand: 'lit:Femme' }),
        ],
      },
      { label: 'epouse', conditions: [cond({ operand: 'lit:Femme' })] },
    ];
    const dead = person({ dates: [{ type: 'memorial', title: 'D', date: new Date(2021, 0, 1) }] });
    expect(resolveLabel(widow, 'Conjoint', female, dead, NOW).label).toBe('veuve');
    expect(resolveLabel(widow, 'Conjoint', female, EMPTY_PERSON_CONTEXT, NOW).label).toBe('epouse');
  });
});
