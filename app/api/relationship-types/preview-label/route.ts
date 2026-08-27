import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { previewLabelSchema, validateRequest } from '@/lib/validations';
import { collectDataNeeds, loadPersonContexts } from '@/lib/relationship-labels/context';
import { resolveLabel } from '@/lib/relationship-labels/resolver';
import { EMPTY_PERSON_CONTEXT } from '@/lib/relationship-labels/types';

/**
 * Resolves a label against a configuration that has not been saved yet, so the
 * editor can show what a rule would produce before the user commits to it.
 * Reads only, writes nothing.
 */
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(previewLabelSchema, body);
    if (!validation.success) {
      return validation.response;
    }

    const { typeLabel, describedPersonId, otherPersonId, variants } = validation.data;
    const personIds = Array.from(new Set([describedPersonId, otherPersonId]));

    const owned = await prisma.person.count({
      where: { id: { in: personIds }, userId: session.user.id, deletedAt: null },
    });
    if (owned !== personIds.length) {
      return apiResponse.notFound('Person not found');
    }

    const contexts = await loadPersonContexts(
      session.user.id,
      personIds,
      collectDataNeeds(variants)
    );

    const resolved = resolveLabel(
      variants,
      typeLabel,
      contexts.get(describedPersonId) ?? EMPTY_PERSON_CONTEXT,
      contexts.get(otherPersonId) ?? EMPTY_PERSON_CONTEXT,
      new Date()
    );

    return apiResponse.ok({
      data: { label: resolved.label, variantIndex: resolved.variantIndex },
    });
  } catch (error) {
    return handleApiError(error, 'relationship-label-preview');
  }
});
