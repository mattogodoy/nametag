import type {
  CustomFieldType,
  LabelConditionOperator,
  LabelConditionSource,
  LabelConditionSubject,
} from '@prisma/client';

export type LabelSubject = LabelConditionSubject;
export type LabelSource = LabelConditionSource;
export type LabelOperator = LabelConditionOperator;

/**
 * Native Person columns a condition may read. Everything outside this list is
 * deliberately out of scope (see the design spec).
 */
export const PERSON_FIELD_KEYS = [
  'gender',
  'prefix',
  'suffix',
  'nickname',
  'name',
  'surname',
  'middleName',
  'secondLastName',
  'organization',
  'jobTitle',
] as const;

export type PersonFieldKey = (typeof PERSON_FIELD_KEYS)[number];

export function isPersonFieldKey(value: string): value is PersonFieldKey {
  return (PERSON_FIELD_KEYS as readonly string[]).includes(value);
}

export interface LabelCondition {
  subject: LabelSubject;
  source: LabelSource;
  subjectRef: string;
  operator: LabelOperator;
  operand: string | null;
}

export interface LabelVariant {
  label: string;
  conditions: LabelCondition[];
}

export interface PersonDateEntry {
  type: string | null;
  title: string;
  date: Date;
}

/**
 * Everything the engine may read about one person. Built by `context.ts`, or
 * synthesised for the account holder, who has name fields only.
 */
export interface PersonLabelContext {
  fields: Partial<Record<PersonFieldKey, string | null>>;
  groupIds: ReadonlySet<string>;
  customValues: ReadonlyMap<string, { type: CustomFieldType; value: string }>;
  dates: readonly PersonDateEntry[];
}

/**
 * The outcome of one resolution. Grammatical attributes (article, grammatical
 * gender) will be added here by the change that introduces them on the variant,
 * not before.
 */
export interface ResolvedLabel {
  label: string;
  /** Index in the variant list, or null when the synthesised fallback applied. */
  variantIndex: number | null;
}

export const EMPTY_PERSON_CONTEXT: PersonLabelContext = {
  fields: {},
  groupIds: new Set<string>(),
  customValues: new Map<string, { type: CustomFieldType; value: string }>(),
  dates: [],
};

export const LABEL_SUBJECTS: [LabelSubject, ...LabelSubject[]] = ['DESCRIBED', 'OTHER'];

export const LABEL_SOURCES: [LabelSource, ...LabelSource[]] = [
  'PERSON_FIELD',
  'CUSTOM_FIELD',
  'GROUP',
  'DATE_TYPE',
  'DATE_TITLE',
];

export const TEXT_OPERATORS: readonly LabelOperator[] = [
  'IS', 'IS_NOT', 'CONTAINS', 'NOT_CONTAINS', 'IS_SET', 'IS_NOT_SET',
];

export const NUMBER_OPERATORS: readonly LabelOperator[] = [
  'EQUALS', 'NOT_EQUALS', 'GT', 'GTE', 'LT', 'LTE', 'IS_SET', 'IS_NOT_SET',
];

export const BOOLEAN_OPERATORS: readonly LabelOperator[] = [
  'IS_TRUE', 'IS_FALSE', 'IS_SET', 'IS_NOT_SET',
];

export const GROUP_OPERATORS: readonly LabelOperator[] = ['IN_GROUP', 'NOT_IN_GROUP'];

export const DATE_OPERATORS: readonly LabelOperator[] = [
  'BEFORE', 'ON_OR_BEFORE', 'AFTER', 'ON_OR_AFTER', 'SAME_DAY', 'NOT_SAME_DAY',
  'IS_SET', 'IS_NOT_SET',
];

/** Every operator, as a tuple, so it can seed a Zod enum. */
export const ALL_LABEL_OPERATORS: [LabelOperator, ...LabelOperator[]] = [
  'IS', 'IS_NOT', 'CONTAINS', 'NOT_CONTAINS', 'EQUALS', 'NOT_EQUALS',
  'GT', 'GTE', 'LT', 'LTE', 'IS_TRUE', 'IS_FALSE', 'IN_GROUP', 'NOT_IN_GROUP',
  'BEFORE', 'ON_OR_BEFORE', 'AFTER', 'ON_OR_AFTER', 'SAME_DAY', 'NOT_SAME_DAY',
  'IS_SET', 'IS_NOT_SET',
];

/** Operators that must not carry an operand. Everything else requires one. */
export const OPERATORS_WITHOUT_OPERAND: ReadonlySet<LabelOperator> = new Set<LabelOperator>([
  'IS_SET', 'IS_NOT_SET', 'IS_TRUE', 'IS_FALSE', 'IN_GROUP', 'NOT_IN_GROUP',
]);

/**
 * The operators offered for a given source. The editor filters its dropdown with
 * this, and the server validates with it, so the two can never disagree.
 * A custom field accepts any scalar operator: the template's own type narrows it
 * further in the editor, and the engine falls back to false when the operator
 * does not fit the stored value.
 */
export function operatorsForSource(source: LabelSource): readonly LabelOperator[] {
  switch (source) {
    case 'GROUP':
      return GROUP_OPERATORS;
    case 'DATE_TYPE':
    case 'DATE_TITLE':
      return DATE_OPERATORS;
    case 'CUSTOM_FIELD':
      return [...TEXT_OPERATORS, ...NUMBER_OPERATORS, ...BOOLEAN_OPERATORS];
    case 'PERSON_FIELD':
      return TEXT_OPERATORS;
  }
}
