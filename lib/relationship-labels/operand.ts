import type { CustomFieldType } from '@prisma/client';
import {
  isPersonFieldKey,
  type LabelSource,
  type PersonLabelContext,
} from './types';

export type Operand =
  | { kind: 'literal'; value: string }
  | { kind: 'now' }
  | { kind: 'ref'; ref: string };

const LITERAL_PREFIX = 'lit:';
const REF_PREFIX = 'ref:';
const NOW_TOKEN = 'now';

/**
 * Reads the self-describing `operand` column. Returns null when the operand is
 * absent OR unreadable: both collapse to the same outcome, since the engine
 * treats a condition it cannot evaluate as false rather than raising.
 */
export function parseOperand(raw: string | null): Operand | null {
  if (raw === null) return null;
  if (raw === NOW_TOKEN) return { kind: 'now' };
  if (raw.startsWith(LITERAL_PREFIX)) {
    return { kind: 'literal', value: raw.slice(LITERAL_PREFIX.length) };
  }
  if (raw.startsWith(REF_PREFIX)) {
    const ref = raw.slice(REF_PREFIX.length);
    return ref.length > 0 ? { kind: 'ref', ref } : null;
  }
  return null;
}

export function serializeOperand(operand: Operand): string {
  switch (operand.kind) {
    case 'literal':
      return `${LITERAL_PREFIX}${operand.value}`;
    case 'now':
      return NOW_TOKEN;
    case 'ref':
      return `${REF_PREFIX}${operand.ref}`;
  }
}

export type RawValue =
  | { kind: 'text'; value: string }
  | { kind: 'date'; value: Date }
  | { kind: 'group'; present: boolean }
  | { kind: 'custom'; type: CustomFieldType; value: string }
  | null;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function earliestDate(
  context: PersonLabelContext,
  matches: (entry: { type: string | null; title: string }) => boolean
): RawValue {
  let found: Date | null = null;
  for (const entry of context.dates) {
    if (!matches(entry)) continue;
    if (found === null || entry.date.getTime() < found.getTime()) {
      found = entry.date;
    }
  }
  return found === null ? null : { kind: 'date', value: found };
}

/**
 * Reads one bare reference against a person context. Used for both sides of a
 * condition, since a cross-person comparison shares the condition's `source`.
 * Returns null when the person has no such value.
 */
export function readReference(
  context: PersonLabelContext,
  source: LabelSource,
  ref: string
): RawValue {
  switch (source) {
    case 'PERSON_FIELD': {
      if (!isPersonFieldKey(ref)) return null;
      const value = context.fields[ref];
      if (value === undefined || value === null || value.trim() === '') return null;
      return { kind: 'text', value };
    }
    case 'GROUP':
      return { kind: 'group', present: context.groupIds.has(ref) };
    case 'CUSTOM_FIELD': {
      const entry = context.customValues.get(ref);
      if (!entry || entry.value.trim() === '') return null;
      return { kind: 'custom', type: entry.type, value: entry.value };
    }
    case 'DATE_TYPE':
      return earliestDate(context, (entry) => entry.type === ref);
    case 'DATE_TITLE': {
      const wanted = normalize(ref);
      return earliestDate(context, (entry) => normalize(entry.title) === wanted);
    }
  }
}
