import { prisma } from '@/lib/prisma';
import { customFieldTemplateUpdateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName } from '@/lib/sanitize';

/**
 * Detects an unambiguous option rename by set-difference.
 *
 * Returns `{ from, to }` only when exactly one option was removed and one was
 * added — the single case where rename intent is clear. Pure adds, pure removes,
 * and multi-renames return null so the cascade is skipped safely (existing values
 * for removed options stay in the DB and surface as out-of-options warnings in UI).
 */
function detectOptionRename(
  oldOptions: string[],
  newOptions: string[]
): { from: string; to: string } | null {
  const oldSet = new Set(oldOptions);
  const newSet = new Set(newOptions);
  const removed = oldOptions.filter((o) => !newSet.has(o));
  const added = newOptions.filter((o) => !oldSet.has(o));

  if (removed.length === 1 && added.length === 1) {
    return { from: removed[0], to: added[0] };
  }
  return null;
}

// GET /api/custom-field-templates/[id] - Get a single custom field template
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const template = await prisma.customFieldTemplate.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });

    if (!template) {
      return apiResponse.notFound('Custom field template not found');
    }

    return apiResponse.ok({ template });
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-get');
  }
});

// PUT /api/custom-field-templates/[id] - Update a custom field template
export const PUT = withAuth(async (request, session, context) => {
  try {
    const { id } = await context.params;

    const body = await parseRequestBody(request);
    const validation = validateRequest(customFieldTemplateUpdateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, options } = validation.data;

    // Load existing template
    const existing = await prisma.customFieldTemplate.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return apiResponse.notFound('Custom field template not found');
    }

    // Build update data (slug is immutable — never updated)
    const updateData: { name?: string; options?: string[] } = {};
    if (name !== undefined) {
      updateData.name = sanitizeName(name) || name;
    }
    if (options !== undefined) {
      updateData.options = options;
    }

    // Detect an unambiguous option rename for SELECT templates and cascade it.
    const rename =
      options !== undefined && existing.type === 'SELECT'
        ? detectOptionRename(existing.options, options)
        : null;

    let template: Awaited<ReturnType<typeof prisma.customFieldTemplate.update<{
      where: { id: string };
      data: { name?: string; options?: string[] };
      include: { _count: { select: { values: true } } };
    }>>>;

    if (rename !== null) {
      // Wrap in a transaction to cascade the option rename
      await prisma.$transaction(async (tx) => {
        await tx.customFieldTemplate.update({
          where: { id },
          data: updateData,
        });

        await tx.personCustomFieldValue.updateMany({
          where: { templateId: id, value: rename.from },
          data: { value: rename.to },
        });
      });

      // Reload with _count after transaction
      const reloaded = await prisma.customFieldTemplate.findFirst({
        where: { id, userId: session.user.id, deletedAt: null },
        include: { _count: { select: { values: true } } },
      });

      if (!reloaded) {
        return apiResponse.notFound('Custom field template not found');
      }

      template = reloaded;
    } else {
      template = await prisma.customFieldTemplate.update({
        where: { id },
        data: updateData,
        include: { _count: { select: { values: true } } },
      });
    }

    return apiResponse.ok({ template });
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-update');
  }
});

// DELETE /api/custom-field-templates/[id] - Soft-delete a custom field template
export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    const existing = await prisma.customFieldTemplate.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
    });

    if (!existing) {
      return apiResponse.notFound('Custom field template not found');
    }

    await prisma.customFieldTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-delete');
  }
});
