import { prisma } from '@/lib/prisma';
import type { LabelVariant } from './types';

// `prisma` is the soft-delete-extended client (see lib/prisma.ts), so its
// `$transaction` callback receives an extended transaction client whose type
// is not structurally assignable to the plain `Prisma.TransactionClient`.
// Derive the real type from `prisma.$transaction` itself, the same pattern
// already used in lib/carddav/vcard-import.ts.
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TxClient = TransactionCallback extends (tx: infer T) => unknown ? T : never;

/**
 * Deletes the type's variants and writes the received ones in array order.
 * Full replacement keeps `order` off the wire and removes any rank collision.
 * Call inside a transaction.
 */
export async function replaceLabelVariants(
  tx: TxClient,
  relationshipTypeId: string,
  variants: readonly LabelVariant[]
): Promise<void> {
  await tx.relationshipLabelVariant.deleteMany({ where: { relationshipTypeId } });

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    await tx.relationshipLabelVariant.create({
      data: {
        relationshipTypeId,
        label: variant.label,
        order: index,
        conditions: {
          create: variant.conditions.map((condition, conditionIndex) => ({
            subject: condition.subject,
            source: condition.source,
            subjectRef: condition.subjectRef,
            operator: condition.operator,
            operand: condition.operand,
            order: conditionIndex,
          })),
        },
      },
    });
  }
}

/**
 * A condition must never point at another account's group or custom field.
 * Returns the first offending reference, or null when everything checks out.
 */
export async function findForeignReference(
  userId: string,
  variants: readonly LabelVariant[]
): Promise<string | null> {
  const groupIds = new Set<string>();
  const templateIds = new Set<string>();

  for (const variant of variants) {
    for (const condition of variant.conditions) {
      if (condition.source === 'GROUP') groupIds.add(condition.subjectRef);
      if (condition.source === 'CUSTOM_FIELD') templateIds.add(condition.subjectRef);
    }
  }

  if (groupIds.size > 0) {
    const owned = await prisma.group.findMany({
      where: { id: { in: Array.from(groupIds) }, userId, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    for (const id of groupIds) if (!ownedIds.has(id)) return id;
  }

  if (templateIds.size > 0) {
    const owned = await prisma.customFieldTemplate.findMany({
      where: { id: { in: Array.from(templateIds) }, userId, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    for (const id of templateIds) if (!ownedIds.has(id)) return id;
  }

  return null;
}
