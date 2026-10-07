import { YEAR_UNKNOWN_SENTINEL } from '@/lib/date-format';
import { parseOperand, readReference, type RawValue } from './operand';
import { OPERATORS_WITHOUT_OPERAND } from './types';
import type {
  LabelCondition,
  LabelOperator,
  LabelVariant,
  PersonLabelContext,
  ResolvedLabel,
} from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * True when a date carries the year-unknown sentinel. Dates reaching this
 * module are already anchored to local midnight on their real calendar day
 * (context.ts converts stored UTC calendar days on load, and the literal and
 * `now` paths are local by construction), so the year is read directly
 * rather than through `parseCalendarDate`, which expects a raw UTC-stored
 * value and would shift an already-local date across the boundary it exists
 * to correct.
 */
function isSentinelYear(date: Date): boolean {
  return date.getFullYear() <= YEAR_UNKNOWN_SENTINEL;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** The comparable payload of a raw value, or null when there is nothing to compare. */
function comparableText(value: RawValue): string | null {
  if (value === null) return null;
  if (value.kind === 'text') return value.value;
  if (value.kind === 'custom') return value.value;
  return null;
}

function comparableDate(value: RawValue): Date | null {
  return value !== null && value.kind === 'date' ? value.value : null;
}

function evaluateText(operator: LabelOperator, left: string, right: string): boolean {
  const l = normalize(left);
  const r = normalize(right);
  switch (operator) {
    case 'IS':
    case 'EQUALS':
      return l === r;
    case 'IS_NOT':
    case 'NOT_EQUALS':
      return l !== r;
    case 'CONTAINS':
      return l.includes(r);
    case 'NOT_CONTAINS':
      return !l.includes(r);
    default:
      return false;
  }
}

function evaluateNumber(operator: LabelOperator, left: number, right: number): boolean {
  switch (operator) {
    case 'EQUALS':
    case 'IS':
      return left === right;
    case 'NOT_EQUALS':
    case 'IS_NOT':
      return left !== right;
    case 'GT':
      return left > right;
    case 'GTE':
      return left >= right;
    case 'LT':
      return left < right;
    case 'LTE':
      return left <= right;
    default:
      return false;
  }
}

function evaluateDate(operator: LabelOperator, left: Date, right: Date): boolean {
  const l = startOfDay(left);
  const r = startOfDay(right);
  switch (operator) {
    case 'BEFORE':
      return l < r;
    case 'ON_OR_BEFORE':
      return l <= r;
    case 'AFTER':
      return l > r;
    case 'ON_OR_AFTER':
      return l >= r;
    case 'SAME_DAY':
      return l === r;
    case 'NOT_SAME_DAY':
      return l !== r;
    default:
      return false;
  }
}

/**
 * Evaluates one condition. Never throws: a missing value, an unreadable operand,
 * a reference to a deleted entity, or an operator that does not fit the data all
 * make the condition false, so a broken configuration degrades a label to the
 * fallback instead of breaking the page.
 */
export function evaluateCondition(
  condition: LabelCondition,
  described: PersonLabelContext,
  other: PersonLabelContext,
  now: Date
): boolean {
  const subjectContext = condition.subject === 'DESCRIBED' ? described : other;
  const otherContext = condition.subject === 'DESCRIBED' ? other : described;
  const left = readReference(subjectContext, condition.source, condition.subjectRef);

  // Group membership is a boolean with no absent state.
  if (condition.source === 'GROUP') {
    if (left === null || left.kind !== 'group') return false;
    if (condition.operator === 'IN_GROUP') return left.present;
    if (condition.operator === 'NOT_IN_GROUP') return !left.present;
    return false;
  }

  if (condition.operator === 'IS_SET') return left !== null;
  if (condition.operator === 'IS_NOT_SET') return left === null;

  // Every comparison, including the negative ones, is false on absent data.
  if (left === null) return false;

  if (condition.operator === 'IS_TRUE' || condition.operator === 'IS_FALSE') {
    if (left.kind !== 'custom' || left.type !== 'BOOLEAN') return false;
    const isTrue = left.value === 'true';
    return condition.operator === 'IS_TRUE' ? isTrue : !isTrue;
  }

  if (!OPERATORS_WITHOUT_OPERAND.has(condition.operator)) {
    const operand = parseOperand(condition.operand);
    if (operand === null) return false;

    if (operand.kind === 'now') {
      const leftDate = comparableDate(left);
      if (leftDate === null || isSentinelYear(leftDate)) return false;
      return evaluateDate(condition.operator, leftDate, now);
    }

    const right: RawValue =
      operand.kind === 'ref'
        ? readReference(otherContext, condition.source, operand.ref)
        : { kind: 'text', value: operand.value };

    if (right === null) return false;

    const leftDate = comparableDate(left);
    if (leftDate !== null) {
      // A year-unknown date cannot answer an ordering or equality question,
      // so it is treated as absent here even though readReference (and thus
      // IS_SET) correctly reports it as present: the user did record a
      // birthday, they just do not know which year.
      if (isSentinelYear(leftDate)) return false;
      const rightDate =
        right.kind === 'date'
          ? right.value
          : right.kind === 'text'
            ? parseLiteralDate(right.value)
            : null;
      if (rightDate === null || isSentinelYear(rightDate)) return false;
      return evaluateDate(condition.operator, leftDate, rightDate);
    }

    if (left.kind === 'custom' && left.type === 'NUMBER') {
      const leftNumber = toNumber(left.value);
      const rightText = comparableText(right);
      const rightNumber = rightText === null ? null : toNumber(rightText);
      if (leftNumber === null || rightNumber === null) return false;
      return evaluateNumber(condition.operator, leftNumber, rightNumber);
    }

    const leftText = comparableText(left);
    const rightText = comparableText(right);
    if (leftText === null || rightText === null) return false;
    return evaluateText(condition.operator, leftText, rightText);
  }

  return false;
}

/** Reads a literal date written as YYYY-MM-DD. Returns null on anything else. */
function parseLiteralDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Walks the variants in order and returns the first whose conditions all hold.
 * When none does, the explicit fallback applies, or a fallback synthesised from
 * the relationship type's own label.
 */
export function resolveLabel(
  variants: readonly LabelVariant[],
  fallbackLabel: string,
  described: PersonLabelContext,
  other: PersonLabelContext,
  now: Date
): ResolvedLabel {
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const matches = variant.conditions.every((condition) =>
      evaluateCondition(condition, described, other, now)
    );
    if (matches) {
      return { label: variant.label, variantIndex: index };
    }
  }
  return { label: fallbackLabel, variantIndex: null };
}
