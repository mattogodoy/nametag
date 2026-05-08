import { prisma } from '@/lib/prisma';
import { customFieldTemplateReorderSchema, validateRequest } from '@/lib/validations';
import {
  apiResponse,
  handleApiError,
  parseRequestBody,
  withAuth,
} from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(customFieldTemplateReorderSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const { ids } = validation.data;

    // Load the full set of active templates for this user
    const activeTemplates = await prisma.customFieldTemplate.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    // The submitted list must be an exact match of the active set (same length, same ids)
    if (activeTemplates.length !== ids.length) {
      return apiResponse.error('Reorder must include all active templates');
    }

    const activeIdSet = new Set(activeTemplates.map((t) => t.id));
    const submittedIdSet = new Set(ids);
    if (activeIdSet.size !== submittedIdSet.size || [...activeIdSet].some((id) => !submittedIdSet.has(id))) {
      return apiResponse.error('Reorder must include all active templates');
    }

    // Apply order updates atomically
    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.customFieldTemplate.update({
          where: { id },
          data: { order: idx },
        })
      )
    );

    return apiResponse.success();
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-reorder');
  }
});
