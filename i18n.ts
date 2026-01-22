import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { isSupportedLocale, normalizeLocale } from './lib/locale';
import { type SupportedLocale,  DEFAULT_LOCALE } from './lib/locale-config';

/**
 * next-intl configuration
 * This runs on every request to determine the locale
 * Note: We can't use auth() here due to Next.js 16 limitations
 */
export default getRequestConfig(async () => {
  // Try to get locale from cookie first
  let locale: SupportedLocale = DEFAULT_LOCALE;

  try {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get('NEXT_LOCALE');

    if (localeCookie?.value && isSupportedLocale(localeCookie.value)) {
      locale = localeCookie.value;
    } else {
      // Fall back to browser detection
      const headersList = await headers();
      const acceptLanguage = headersList.get('accept-language');

      if (acceptLanguage) {
        const locales = acceptLanguage
          .split(',')
          .map(lang => {
            const [localeStr] = lang.trim().split(';');
            return localeStr.trim();
          });

        for (const browserLocale of locales) {
          if (isSupportedLocale(browserLocale)) {
            locale = browserLocale;
            break;
          }

          // Normalize by language code / aliases (e.g. "de" -> "de-DE", "no" -> "nb-NO")
          const normalized = normalizeLocale(browserLocale);
          if (normalized) {
            locale = normalized;
            break;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error detecting locale:', error);
  }

  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default,
  };
});
