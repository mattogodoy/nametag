import type { CustomFieldType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseOperand } from './operand';
import {
  isPersonFieldKey,
  type LabelVariant,
  type PersonDateEntry,
  type PersonFieldKey,
  type PersonLabelContext,
} from './types';

export interface LabelDataNeeds {
  fields: PersonFieldKey[];
  groups: boolean;
  templateIds: string[];
  dates: boolean;
}

/**
 * Walks the configuration once to learn which sources are actually referenced,
 * so a user who only conditions on gender never pays for a groups query.
 */
export function collectDataNeeds(variants: readonly LabelVariant[]): LabelDataNeeds {
  const fields = new Set<PersonFieldKey>();
  const templateIds = new Set<string>();
  let groups = false;
  let dates = false;

  const note = (source: string, ref: string): void => {
    if (source === 'PERSON_FIELD') {
      if (isPersonFieldKey(ref)) fields.add(ref);
      return;
    }
    if (source === 'GROUP') {
      groups = true;
      return;
    }
    if (source === 'CUSTOM_FIELD') {
      templateIds.add(ref);
      return;
    }
    dates = true;
  };

  for (const variant of variants) {
    for (const condition of variant.conditions) {
      note(condition.source, condition.subjectRef);
      const operand = parseOperand(condition.operand);
      if (operand?.kind === 'ref') note(condition.source, operand.ref);
    }
  }

  return {
    fields: Array.from(fields),
    groups,
    templateIds: Array.from(templateIds),
    dates,
  };
}

function emptyContext(): {
  fields: Partial<Record<PersonFieldKey, string | null>>;
  groupIds: Set<string>;
  customValues: Map<string, { type: CustomFieldType; value: string }>;
  dates: PersonDateEntry[];
} {
  return { fields: {}, groupIds: new Set(), customValues: new Map(), dates: [] };
}

/**
 * Loads every person context in bulk, in at most four grouped queries and never
 * one per person. The module owns its own reads so no call site has to widen a
 * Prisma select and risk forgetting a column.
 */
export async function loadPersonContexts(
  userId: string,
  personIds: readonly string[],
  needs: LabelDataNeeds
): Promise<Map<string, PersonLabelContext>> {
  const contexts = new Map<string, ReturnType<typeof emptyContext>>();
  const ids = Array.from(new Set(personIds));

  const needsAnything =
    needs.fields.length > 0 || needs.groups || needs.templateIds.length > 0 || needs.dates;
  if (ids.length === 0 || !needsAnything) {
    return new Map<string, PersonLabelContext>();
  }

  const contextFor = (personId: string): ReturnType<typeof emptyContext> => {
    const existing = contexts.get(personId);
    if (existing) return existing;
    const created = emptyContext();
    contexts.set(personId, created);
    return created;
  };

  const work: Array<Promise<void>> = [];

  if (needs.fields.length > 0) {
    const select: Record<string, boolean> = { id: true };
    for (const field of needs.fields) select[field] = true;
    work.push(
      prisma.person
        .findMany({
          where: { id: { in: ids }, userId, deletedAt: null },
          select,
        })
        .then((rows) => {
          for (const row of rows as Array<Record<string, string | null>>) {
            const personId = row.id;
            if (typeof personId !== 'string') continue;
            const context = contextFor(personId);
            for (const field of needs.fields) {
              context.fields[field] = row[field] ?? null;
            }
          }
        })
    );
  }

  if (needs.groups) {
    work.push(
      prisma.personGroup
        .findMany({
          where: { personId: { in: ids }, group: { deletedAt: null, userId } },
          select: { personId: true, groupId: true },
        })
        .then((rows) => {
          for (const row of rows) contextFor(row.personId).groupIds.add(row.groupId);
        })
    );
  }

  if (needs.templateIds.length > 0) {
    work.push(
      prisma.personCustomFieldValue
        .findMany({
          where: {
            personId: { in: ids },
            templateId: { in: needs.templateIds },
            template: { deletedAt: null, userId },
          },
          select: {
            personId: true,
            templateId: true,
            value: true,
            template: { select: { type: true } },
          },
        })
        .then((rows) => {
          for (const row of rows) {
            contextFor(row.personId).customValues.set(row.templateId, {
              type: row.template.type,
              value: row.value,
            });
          }
        })
    );
  }

  if (needs.dates) {
    work.push(
      prisma.importantDate
        .findMany({
          // Scoped through the person as well as the id list, so the query
          // defends itself rather than trusting the caller's ids.
          where: {
            personId: { in: ids },
            deletedAt: null,
            person: { userId, deletedAt: null },
          },
          select: { personId: true, type: true, title: true, date: true },
        })
        .then((rows) => {
          for (const row of rows) {
            contextFor(row.personId).dates.push({
              type: row.type,
              title: row.title,
              date: row.date,
            });
          }
        })
    );
  }

  await Promise.all(work);

  const result = new Map<string, PersonLabelContext>();
  for (const [personId, context] of contexts) result.set(personId, context);
  return result;
}
