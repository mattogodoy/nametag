/**
 * Central list of supported languages/locales for the UI (display name/flag) plus the technical locale code.
 * `as const` keeps literal types (e.g. "en" instead of just `string`) so we can derive unions from it.
 * There is an optional field aliases as needed for no and np.
 */
export const LANGUAGES = [
  { code: 'en' as const, name: 'English', flag: 'gb' },
  { code: 'es-ES' as const, name: 'Español (España)', flag: 'es' },
  { code: 'ja-JP' as const, name: '日本語', flag: 'jp' },
  { code: 'nb-NO' as const, name: 'Norsk bokmål', flag: 'no', aliases: ['no'] as const },
  { code: 'de-DE' as const, name: 'Deutsch (German)', flag: 'de' },
] as const;

/**
 * Supported Locales generated out of the list above
 */
export const SUPPORTED_LOCALES = LANGUAGES.map(l => l.code) as readonly typeof LANGUAGES[number]['code'][];

/**
 * Supported Locales type generated out of the list above
 */

export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Default locale
 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';
