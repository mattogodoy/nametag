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
