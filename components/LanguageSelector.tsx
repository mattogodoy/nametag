'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import 'flag-icons/css/flag-icons.min.css';

interface LanguageSelectorProps {
  currentLanguage: 'en' | 'es-ES' | 'ja-JP';
}

const LANGUAGES = [
  { code: 'en' as const, name: 'English', flag: 'gb' },
  { code: 'es-ES' as const, name: 'Español (España)', flag: 'es' },
  { code: 'ja-JP' as const, name: '日本語', flag: 'jp' },
];

export default function LanguageSelector({ currentLanguage }: LanguageSelectorProps) {
  const t = useTranslations('settings.appearance.language');
  const tSuccess = useTranslations('success.profile');
  const tCommon = useTranslations('common');

  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [isLoading, setIsLoading] = useState(false);

  const handleLanguageChange = async (newLanguage: 'en' | 'es-ES' | 'ja-JP') => {
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
      const secure = process.env.NODE_ENV === 'production' ? '; secure' : '';
      const domainAttr = domain ? `; domain=${domain}` : '';

      document.cookie = `NEXT_LOCALE=${newLanguage}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax${secure}${domainAttr}`;

      toast.success(tSuccess('languageChanged'));

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
      <p className="text-sm text-muted mb-4">
        {t('description')}
      </p>

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
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-border bg-surface hover:bg-surface-elevated'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`fi fi-${language.flag} text-2xl`}></span>
              <div className="flex-1 text-left">
                <div className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>
                  {language.name}
                </div>
                <div className="text-sm text-muted">
                  {t(language.code === 'en' ? 'en' : 'esES' : 'jaJP')}
                </div>
              </div>
              {isSelected && (
                <div className="text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-blue-600 dark:text-blue-400">
          {tCommon('loading')}
        </p>
      )}
    </div>
  );
}
