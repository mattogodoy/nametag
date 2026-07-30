import { prisma } from '@/lib/prisma';
import {
  isSupportedLocale,
  setLocaleCookie,
  SUPPORTED_LOCALES,
} from '@/lib/locale';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

/**
 * PUT /api/user/language
 * Update user's language preference
 */
export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody<{ language?: unknown }>(request);
    const { language } = body;

    if (typeof language !== 'string' || !isSupportedLocale(language)) {
      return apiResponse.error(
        `Invalid language. Supported languages: ${SUPPORTED_LOCALES.join(', ')}`
      );
    }

    // Update user's language preference in database
    await prisma.user.update({
      where: { id: session.user.id },
      data: { language },
    });

    // Set cookie for immediate effect
    await setLocaleCookie(language);

    return apiResponse.ok({ success: true, language });
  } catch (error) {
    return handleApiError(error, 'user-language');
  }
});
