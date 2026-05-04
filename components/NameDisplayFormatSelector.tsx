'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface NameDisplayFormatSelectorProps {
  currentFormat: 'FULL' | 'NICKNAME_PREFERRED' | 'SHORT';
}

export default function NameDisplayFormatSelector({ currentFormat }: NameDisplayFormatSelectorProps) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [nameDisplayFormat, setNameDisplayFormat] = useState(currentFormat);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const formats: Array<{ value: 'FULL' | 'NICKNAME_PREFERRED' | 'SHORT'; label: string; description: string }> = [
    { value: 'FULL', label: t('nameDisplayFormatFull'), description: t('nameDisplayFormatFullDescription') },
    { value: 'NICKNAME_PREFERRED', label: t('nameDisplayFormatNicknamePreferred'), description: t('nameDisplayFormatNicknamePreferredDescription') },
    { value: 'SHORT', label: t('nameDisplayFormatShort'), description: t('nameDisplayFormatShortDescription') },
  ];

  const handleFormatChange = async (newFormat: 'FULL' | 'NICKNAME_PREFERRED' | 'SHORT') => {
    if (newFormat === nameDisplayFormat) return;
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/user/name-display-format', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameDisplayFormat: newFormat }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || t('nameDisplayFormatError'));
        setIsSuccess(false);
        return;
      }

      setNameDisplayFormat(newFormat);
      setMessage(t('nameDisplayFormatSuccess'));
      setIsSuccess(true);
      router.refresh();

      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('nameDisplayFormatError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="space-y-3">
        {formats.map((format) => (
          <button
            key={format.value}
            onClick={() => handleFormatChange(format.value)}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 border-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              nameDisplayFormat === format.value
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">
                  {format.label}
                </div>
                <div className="text-sm text-muted">
                  {format.description}
                </div>
              </div>
              {nameDisplayFormat === format.value && (
                <div className="text-primary">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {message && (
        <p className={`mt-4 text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
