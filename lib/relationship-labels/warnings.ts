import type { LabelCondition, LabelVariant } from './types';

export type LabelWarningCode =
  | 'UNREACHABLE_AFTER_FALLBACK'
  | 'DUPLICATE_VARIANT'
  | 'ALWAYS_TRUE'
  | 'BROKEN_REFERENCE';

export interface LabelWarning {
  variantIndex: number;
  /** null when the warning is about the variant rather than one condition. */
  conditionIndex: number | null;
  code: LabelWarningCode;
}

export interface KnownReferences {
  groupIds: readonly string[];
  templateIds: readonly string[];
}

/**
 * The operand carries free text a user typed, so the key must not be a plain
 * join: a literal containing the separator would collide with a genuinely
 * different condition list. JSON encoding escapes the payload, so distinct
 * inputs always produce distinct keys.
 */
function conditionKey(condition: LabelCondition): string {
  return JSON.stringify([
    condition.subject,
    condition.source,
    condition.subjectRef.trim().toLowerCase(),
    condition.operator,
    condition.operand ?? '',
  ]);
}

function variantKey(variant: LabelVariant): string {
  return JSON.stringify(variant.conditions.map(conditionKey));
}

/**
 * A birth date can only be in the past, so comparing it to the current instant
 * with a past-facing operator is always true and the rule has no useful effect.
 */
function isAlwaysTrue(condition: LabelCondition): boolean {
  return (
    condition.source === 'DATE_TYPE' &&
    condition.subjectRef === 'birthday' &&
    condition.operand === 'now' &&
    (condition.operator === 'BEFORE' || condition.operator === 'ON_OR_BEFORE')
  );
}

function isBroken(condition: LabelCondition, known: KnownReferences): boolean {
  if (condition.source === 'GROUP') return !known.groupIds.includes(condition.subjectRef);
  if (condition.source === 'CUSTOM_FIELD') return !known.templateIds.includes(condition.subjectRef);
  return false;
}

/**
 * Non-blocking diagnostics shown in the editor. Returns codes only; the UI turns
 * them into translated sentences.
 */
export function findLabelWarnings(
  variants: readonly LabelVariant[],
  known: KnownReferences
): LabelWarning[] {
  const warnings: LabelWarning[] = [];
  const seen = new Set<string>();
  let fallbackIndex: number | null = null;

  variants.forEach((variant, variantIndex) => {
    if (variant.conditions.length === 0) {
      if (fallbackIndex === null) fallbackIndex = variantIndex;
      return;
    }

    if (fallbackIndex !== null) {
      warnings.push({ variantIndex, conditionIndex: null, code: 'UNREACHABLE_AFTER_FALLBACK' });
    }

    const key = variantKey(variant);
    if (seen.has(key)) {
      warnings.push({ variantIndex, conditionIndex: null, code: 'DUPLICATE_VARIANT' });
    } else {
      seen.add(key);
    }

    variant.conditions.forEach((condition, conditionIndex) => {
      if (isAlwaysTrue(condition)) {
        warnings.push({ variantIndex, conditionIndex, code: 'ALWAYS_TRUE' });
      }
      if (isBroken(condition, known)) {
        warnings.push({ variantIndex, conditionIndex, code: 'BROKEN_REFERENCE' });
      }
    });
  });

  return warnings;
}
