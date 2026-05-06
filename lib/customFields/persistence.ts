import { prisma as prismaClient } from '@/lib/prisma';
import { validateRawValue, isEmptyRawValue } from './values';

// Type that accepts the extended Prisma client (with soft-delete extension)
type PrismaClientLike = typeof prismaClient;

export class CustomFieldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CustomFieldValidationError';
  }
}

export interface CustomFieldValueInput {
  templateId: string;
  value: string;
}

/**
 * Validate customFieldValues inputs against the user's templates without persisting anything.
 *
 * Use this before creating a person so validation errors can be returned before any DB writes
 * to Person occur, avoiding the need for a hard-delete rollback.
 *
 * Throws CustomFieldValidationError on any validation failure.
 */
export async function validateCustomFieldValues(
  prisma: PrismaClientLike,
  userId: string,
  inputs: CustomFieldValueInput[]
): Promise<void> {
  if (inputs.length === 0) return;

  for (const input of inputs) {
    if (isEmptyRawValue(input.value)) {
      throw new CustomFieldValidationError(
        'Empty custom field values must be omitted from the request, not sent'
      );
    }
  }

  const templateIds = Array.from(new Set(inputs.map((i) => i.templateId)));
  const templates = await prisma.customFieldTemplate.findMany({
    where: {
      id: { in: templateIds },
      userId,
      deletedAt: null,
    },
  });
  const byId = new Map(templates.map((t) => [t.id, t]));

  for (const input of inputs) {
    const template = byId.get(input.templateId);
    if (!template) {
      throw new CustomFieldValidationError(
        `Custom field template ${input.templateId} not found`
      );
    }
    const result = validateRawValue(template.type, input.value, template.options);
    if (!result.ok) {
      throw new CustomFieldValidationError(`${template.name}: ${result.error}`);
    }
  }
}

/**
 * Diff and apply customFieldValues for a person.
 *
 * Behavior:
 *   - inputs is what the client sent. undefined means "don't touch existing values" — caller should
 *     not call this function in that case.
 *   - Empty array means "clear all values for this person".
 *   - Non-empty array: validate each entry against its template's type, delete rows for templates
 *     not in the new set, upsert rows in the new set.
 *
 * Throws CustomFieldValidationError on validation failures. Caller should convert that into a 400.
 */
export async function applyCustomFieldValues(
  prisma: PrismaClientLike,
  userId: string,
  personId: string,
  inputs: CustomFieldValueInput[]
): Promise<void> {
  if (inputs.length === 0) {
    await prisma.personCustomFieldValue.deleteMany({ where: { personId } });
    return;
  }

  // Validate first — throws CustomFieldValidationError on any failure
  await validateCustomFieldValues(prisma, userId, inputs);

  // Apply: delete templates no longer in the set + upsert each provided value, in one transaction
  const incomingIds = inputs.map((i) => i.templateId);
  await prisma.$transaction([
    prisma.personCustomFieldValue.deleteMany({
      where: { personId, templateId: { notIn: incomingIds } },
    }),
    ...inputs.map((input) =>
      prisma.personCustomFieldValue.upsert({
        where: { personId_templateId: { personId, templateId: input.templateId } },
        create: { personId, templateId: input.templateId, value: input.value },
        update: { value: input.value },
      })
    ),
  ]);
}
