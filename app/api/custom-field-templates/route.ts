import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { customFieldTemplateCreateSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { sanitizeName } from '@/lib/sanitize';
import { canCreateResource } from '@/lib/billing';
import { deriveSlug } from '@/lib/customFields/slug';

// GET /api/custom-field-templates - List all custom field templates for the current user
export const GET = withAuth(async (_request, session) => {
  try {
    const templates = await prisma.customFieldTemplate.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { values: true },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return apiResponse.ok({ templates });
  } catch (error) {
    return handleApiError(error, 'custom-field-templates-list');
  }
});

// POST /api/custom-field-templates - Create a new custom field template
export const POST = withAuth(async (request, session) => {
  try {
    // Check tier limit
    const usageCheck = await canCreateResource(session.user.id, 'customFieldTemplates');
    if (!usageCheck.allowed) {
      return apiResponse.forbidden(
        `You've reached your plan limit of ${usageCheck.limit} custom fields. ` +
          `Please upgrade your plan to add more.`
      );
    }

    const body = await parseRequestBody(request);
    const validation = validateRequest(customFieldTemplateCreateSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { name, type, options } = validation.data;

    // Sanitize the name
    const sanitizedName = sanitizeName(name) || name;

    // Derive slug from name
    const slug = deriveSlug(sanitizedName);
    if (!slug) {
      return apiResponse.error('Name must contain at least one alphanumeric character');
    }

    // Compute next order value
    const lastTemplate = await prisma.customFieldTemplate.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = (lastTemplate?.order ?? -1) + 1;

    const template = await prisma.customFieldTemplate.create({
      data: {
        userId: session.user.id,
        name: sanitizedName,
        slug,
        type,
        options: options ?? [],
        order,
      },
      include: {
        _count: {
          select: { values: true },
        },
      },
    });

    return apiResponse.created({ template });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return apiResponse.error('A custom field with this name already exists', 409);
    }
    return handleApiError(error, 'custom-field-templates-create');
  }
});
