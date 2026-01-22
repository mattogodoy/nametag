import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';

/**
 * Supported locales
 */
export const SUPPORTED_LOCALES = ['en', 'es-ES', 'ja-JP', 'nb-NO', 'de-DE'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Default locale
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * Cookie name for locale preference
 */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * Check if a locale is supported
 */
export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Normalize locale string (e.g., "es" -> "es-ES")
 */
export function normalizeLocale(locale: string): SupportedLocale {
  // Handle exact matches first
  if (isSupportedLocale(locale)) {
    return locale;
  }

  // Handle language code only (e.g., "es" -> "es-ES")
  const languageCode = locale.split('-')[0].toLowerCase();

  if (languageCode === 'es') {
    return 'es-ES';
  }

  if (languageCode === 'en') {
    return 'en';
  }

  if (languageCode === 'ja') {
    return 'ja-JP';
  }

  if (languageCode === 'nb' || languageCode === 'no') {
    return 'nb-NO';
  }

  if (languageCode === 'de') {
    return 'de-DE';
  }

  return DEFAULT_LOCALE;
}

/**
 * Get locale from cookie
 */
export async function getLocaleFromCookie(): Promise<SupportedLocale | null> {
  try {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME);

    if (localeCookie?.value && isSupportedLocale(localeCookie.value)) {
      return localeCookie.value;
    }

    return null;
  } catch (error) {
    console.error('Error reading locale cookie:', error);
    return null;
  }
}

/**
 * Set locale cookie
 */
export async function setLocaleCookie(locale: SupportedLocale): Promise<void> {
  try {
    const cookieStore = await cookies();
    const cookieOptions: {
      path: string;
      maxAge: number;
      httpOnly: boolean;
      sameSite: 'lax';
      domain?: string;
      secure?: boolean;
    } = {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      httpOnly: false, // Allow client-side access
      sameSite: 'lax',
    };

    // Add domain for cross-subdomain sharing (production only)
    if (process.env.NEXT_PUBLIC_COOKIE_DOMAIN) {
      cookieOptions.domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
    }

    // Use secure cookies in production
    if (process.env.NODE_ENV === 'production') {
      cookieOptions.secure = true;
    }

    cookieStore.set(LOCALE_COOKIE_NAME, locale, cookieOptions);
  } catch (error) {
    console.error('Error setting locale cookie:', error);
  }
}

/**
 * Detect browser locale from Accept-Language header
 */
export async function detectBrowserLocale(): Promise<SupportedLocale> {
  try {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');

    if (!acceptLanguage) {
      return DEFAULT_LOCALE;
    }

    // Parse Accept-Language header
    // Format: "en-US,en;q=0.9,es;q=0.8"
    const locales = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, qValue] = lang.trim().split(';');
        const quality = qValue ? parseFloat(qValue.split('=')[1]) : 1.0;
        return { locale: locale.trim(), quality };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported locale
    for (const { locale } of locales) {
      // Check exact match first
      if (isSupportedLocale(locale)) {
        return locale;
      }

      // Check language code mapping (e.g., "es" -> "es-ES")
      const languageCode = locale.split('-')[0].toLowerCase();
      if (languageCode === 'es') {
        return 'es-ES';
      }
      if (languageCode === 'en') {
        return 'en';
      }
      if (languageCode === 'ja') {
        return 'ja-JP';
      }
      if (languageCode === 'nb' || languageCode === 'no') {
        return 'nb-NO';
      }
      if (languageCode === 'de') {
        return 'de-DE';
      }
    }

    return DEFAULT_LOCALE;
  } catch (error) {
    console.error('Error detecting browser locale:', error);
    return DEFAULT_LOCALE;
  }
}

/**
 * Get user's language preference from database
 */
export async function getUserLanguageFromDB(userId: string): Promise<SupportedLocale | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });

    if (user?.language && isSupportedLocale(user.language)) {
      return user.language;
    }

    return null;
  } catch (error) {
    console.error('Error getting user language from DB:', error);
    return null;
  }
}

/**
 * Get locale for the current user
 * Priority: User DB preference → Cookie → Browser detection → Default
 */
export async function getUserLocale(userId?: string): Promise<SupportedLocale> {
  // 1. Try user's database preference (if logged in)
  if (userId) {
    const userLanguage = await getUserLanguageFromDB(userId);
    if (userLanguage) {
      return userLanguage;
    }
  }

  // 2. Try cookie
  const cookieLocale = await getLocaleFromCookie();
  if (cookieLocale) {
    return cookieLocale;
  }

  // 3. Try browser detection
  const browserLocale = await detectBrowserLocale();

  // 4. Fallback to default
  return browserLocale || DEFAULT_LOCALE;
}

/**
 * Update user's language preference in database
 */
export async function updateUserLanguage(
  userId: string,
  locale: SupportedLocale
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { language: locale },
    });
    return true;
  } catch (error) {
    console.error('Error updating user language:', error);
    return false;
  }
}
