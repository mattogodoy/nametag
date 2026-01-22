import { getTranslations as getT } from 'next-intl/server';
import { getUserLocale} from './locale';
import { type SupportedLocale } from './locale-config';

// Re-export SupportedLocale for convenience
export type { SupportedLocale };

/**
 * Get translations for a specific namespace (server-side)
 * Usage in server components:
 *   const t = await getTranslations('common');
 *   const label = t('save');
 */
export async function getTranslations(namespace?: string) {
  return getT(namespace);
}

/**
 * Get translations for a specific locale (useful for emails)
 */
export async function getTranslationsForLocale(
  locale: SupportedLocale,
  namespace?: string
) {
  const messages = (await import(`@/locales/${locale}.json`)).default;

  // Helper to get nested translation
  const get = (key: string, values?: Record<string, string | number>): string => {
    const keys = namespace ? `${namespace}.${key}`.split('.') : key.split('.');
    let result: Record<string, unknown> | unknown = messages;

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = (result as Record<string, unknown>)[k];
      } else {
        return key; // Return key if not found
      }
    }

    if (typeof result !== 'string') {
      return key;
    }

    // Replace placeholders like {name}, {count}, etc.
    if (values) {
      return result.replace(/\{(\w+)\}/g, (match, key) => {
        return key in values ? String(values[key]) : match;
      });
    }

    return result;
  };

  return get;
}

/**
 * Get translations for emails based on user's language preference
 * Falls back to English if user language is not set
 */
export async function getEmailTranslations(
  userId?: string,
  namespace: string = 'emails'
) {
  const locale = userId ? await getUserLocale(userId) : 'en';
  return getTranslationsForLocale(locale, namespace);
}

/**
 * Interpolate values into a translation string
 * Example: interpolate("Hello {name}", { name: "John" }) => "Hello John"
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in values ? String(values[key]) : match;
  });
}

/**
 * Get the locale to use for a given user ID
 * Useful for server actions and API routes
 */
export async function getLocaleForUser(userId?: string): Promise<SupportedLocale> {
  return getUserLocale(userId);
}
