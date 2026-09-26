import { prisma } from '@/lib/prisma';
import { collectDataNeeds, loadPersonContexts, type LabelDataNeeds } from './context';
import { resolveLabel } from './resolver';
import {
  EMPTY_PERSON_CONTEXT,
  type LabelVariant,
  type PersonLabelContext,
  type ResolvedLabel,
} from './types';

export type { LabelCondition, LabelVariant, PersonLabelContext, ResolvedLabel } from './types';
export { PERSON_FIELD_KEYS, isPersonFieldKey } from './types';
export { findLabelWarnings } from './warnings';
export type { LabelWarning, LabelWarningCode } from './warnings';
export { parseOperand, serializeOperand } from './operand';
export { resolveLabel } from './resolver';

export interface LabelConfig {
  variantsByTypeId: Map<string, LabelVariant[]>;
  needs: LabelDataNeeds;
  hasConditions: boolean;
}

export interface ResolveInput {
  relationshipTypeId: string | null;
  /** The relationship type's own label, used as the synthesised fallback. */
  typeLabel: string;
  describedPersonId: string;
  otherPersonId: string | 'USER';
}

export interface LabelResolver {
  resolve(input: ResolveInput): ResolvedLabel;
}

/**
 * Loads every variant of every relationship type owned by the user, in one query.
 * This is the short-circuit point: when no variant carries a condition, callers
 * skip person loading entirely.
 */
export async function loadLabelConfig(userId: string): Promise<LabelConfig> {
  const rows = await prisma.relationshipLabelVariant.findMany({
    where: { relationshipType: { userId, deletedAt: null } },
    orderBy: [{ relationshipTypeId: 'asc' }, { order: 'asc' }],
    select: {
      relationshipTypeId: true,
      label: true,
      conditions: {
        orderBy: { order: 'asc' },
        select: {
          subject: true,
          source: true,
          subjectRef: true,
          operator: true,
          operand: true,
        },
      },
    },
  });

  const variantsByTypeId = new Map<string, LabelVariant[]>();
  const all: LabelVariant[] = [];

  for (const row of rows) {
    const variant: LabelVariant = { label: row.label, conditions: row.conditions };
    const existing = variantsByTypeId.get(row.relationshipTypeId);
    if (existing) {
      existing.push(variant);
    } else {
      variantsByTypeId.set(row.relationshipTypeId, [variant]);
    }
    all.push(variant);
  }

  const needs = collectDataNeeds(all);
  const hasConditions = all.some((variant) => variant.conditions.length > 0);

  return { variantsByTypeId, needs, hasConditions };
}

/**
 * Builds a resolver over a set of people. Everything is loaded here, so `resolve`
 * is synchronous and safe to call once per displayed relationship.
 */
export async function createLabelResolver(
  userId: string,
  personIds: readonly string[],
  options: { now?: Date; userContext?: PersonLabelContext; config?: LabelConfig } = {}
): Promise<LabelResolver> {
  const config = options.config ?? (await loadLabelConfig(userId));
  const now = options.now ?? new Date();
  const userContext = options.userContext ?? EMPTY_PERSON_CONTEXT;

  const contexts = config.hasConditions
    ? await loadPersonContexts(userId, personIds, config.needs)
    : new Map<string, PersonLabelContext>();

  const contextFor = (personId: string | 'USER'): PersonLabelContext => {
    if (personId === 'USER') return userContext;
    return contexts.get(personId) ?? EMPTY_PERSON_CONTEXT;
  };

  return {
    resolve(input: ResolveInput): ResolvedLabel {
      const variants = input.relationshipTypeId
        ? (config.variantsByTypeId.get(input.relationshipTypeId) ?? [])
        : [];
      return resolveLabel(
        variants,
        input.typeLabel,
        contextFor(input.describedPersonId),
        contextFor(input.otherPersonId),
        now
      );
    },
  };
}
