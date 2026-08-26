'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import 'flag-icons/css/flag-icons.min.css';

interface LanguageSelectorProps {
  currentLanguage: 'en' | 'es-ES' | 'ja-JP' | 'nb-NO' | 'de-DE' | 'zh-CN' | 'it-IT' | 'ru-RU' | 'nl-NL' | 'fr-FR';
}

const LANGUAGES = [
  { code: 'en' as const, name: 'English', flag: 'gb' },
  { code: 'es-ES' as const, name: 'Español (España)', flag: 'es' },
  { code: 'ja-JP' as const, name: '日本語', flag: 'jp' },
  { code: 'nb-NO' as const, name: 'Norsk bokmål', flag: 'no' },
  { code: 'de-DE' as const, name: 'Deutsch (German)', flag: 'de' },
  { code: 'zh-CN' as const, name: '简体中文', flag: 'cn' },
  { code: 'it-IT' as const, name: 'Italiano', flag: 'it' },
  { code: 'ru-RU' as const, name: 'Русский', flag: 'ru' },
  { code: 'nl-NL' as const, name: 'Nederlands (Dutch)', flag: 'nl' },
  { code: 'fr-FR' as const, name: 'Français (France)', flag: 'fr' },
];

const labelMap = {
  en: 'en',
  'es-ES': 'esES',
  'ja-JP': 'jaJP',
  'nb-NO': 'nbNO',
  'de-DE': 'deDE',
  'zh-CN': 'zhCN',
  'it-IT': 'itIT',
  'ru-RU': 'ruRU',
  'nl-NL': 'nlNL',
  'fr-FR': 'frFR',
} as const;

/** How long to wait for an active worker before giving up on the refresh. */
const RECACHE_TIMEOUT_MS = 1000;

/**
 * The service worker precaches /offline, so that copy is stuck in whatever
 * language it was fetched in. Ask the worker to refresh it after a language
 * change. Must be awaited before the reload below, which kills the page.
 */
async function recacheOfflinePage(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return;
  }
  /*
   * The important guard. serviceWorker.ready NEVER settles when no worker is
   * registered, and registration is production-only and swallows its own
   * failures. Awaiting it unguarded would make the reload below unreachable in
   * development always, and in production whenever registration failed, leaving
   * the language change hung with the button stuck disabled. A null controller
   * means there is no worker to notify anyway, so returning early is both the
   * fast path and the safe one.
   */
  if (!navigator.serviceWorker.controller) {
    return;
  }
  try {
    /*
     * Belt and braces for the narrow window where a worker is active but has not
     * yet claimed this page. A stale offline page must never strand the reload.
     */
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), RECACHE_TIMEOUT_MS);
      }),
    ]);
    registration?.active?.postMessage({ type: 'RECACHE_OFFLINE' });
  } catch {
    // A stale offline page is not worth blocking the language change over.
  }
}

export default function LanguageSelector({
  currentLanguage,
}: LanguageSelectorProps) {
  const t = useTranslations('settings.appearance.language');
  const tSuccess = useTranslations('success.profile');
  const tCommon = useTranslations('common');

  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [isLoading, setIsLoading] = useState(false);

  const handleLanguageChange = async (
    newLanguage: 'en' | 'es-ES' | 'ja-JP' | 'nb-NO' | 'de-DE' | 'zh-CN' | 'it-IT' | 'ru-RU' | 'nl-NL' | 'fr-FR',
  ) => {
    if (isLoading || newLanguage === selectedLanguage) return;

    setIsLoading(true);
    setSelectedLanguage(newLanguage);

    try {
      // Call API to update language preference
      const response = await fetch('/api/user/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: newLanguage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update language');
      }

      // Set cookie for immediate effect
      const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
      const domainAttr = domain ? `; domain=${domain}` : '';

      document.cookie = `NEXT_LOCALE=${newLanguage}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax${domainAttr}`;

      toast.success(tSuccess('languageChanged'));

      await recacheOfflinePage();

      // Refresh the page to apply new locale
      window.location.reload();
    } catch (error) {
      console.error('Error updating language:', error);
      toast.error('Failed to update language. Please try again.');
      setSelectedLanguage(currentLanguage);
      setIsLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">{t('description')}</p>

      <div className="space-y-3">
        {LANGUAGES.map((language) => {
          const isSelected = selectedLanguage === language.code;

          return (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language.code)}
              disabled={isLoading}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-surface hover:bg-surface-elevated'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`fi fi-${language.flag} text-2xl`}></span>
              <div className="flex-1 text-left">
                <div
                  className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}
                >
                  {language.name}
                </div>
                <div className="text-sm text-muted">
                  {t(labelMap[language.code])}
                </div>
              </div>
              {isSelected && (
                <div className="text-primary">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-primary">
          {tCommon('loading')}
        </p>
      )}
    </div>
  );
}
