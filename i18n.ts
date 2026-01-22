import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, type SupportedLocale, isSupportedLocale } from './lib/locale';

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

          const languageCode = browserLocale.split('-')[0].toLowerCase();
          if (languageCode === 'es') {
            locale = 'es-ES';
            break;
          }
          if (languageCode === 'en') {
            locale = 'en';
            break;
          }
          if (languageCode === 'ja') {
            locale = 'ja-JP';
            break;
          }
          if (languageCode === 'nb' || languageCode === 'no') {
            locale = 'nb-NO';
            break;
          }
           if (languageCode === 'de') {
            locale = 'de-DE';
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
