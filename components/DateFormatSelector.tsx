'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getDateFormatExample } from '@/lib/date-format';

interface DateFormatSelectorProps {
  userId: string;
  currentFormat: 'MDY' | 'DMY' | 'YMD';
}

export default function DateFormatSelector({ currentFormat }: DateFormatSelectorProps) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [dateFormat, setDateFormat] = useState(currentFormat);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const formats: Array<{ value: 'MDY' | 'DMY' | 'YMD'; label: string }> = [
    { value: 'MDY', label: 'MM/DD/YYYY' },
    { value: 'DMY', label: 'DD/MM/YYYY' },
    { value: 'YMD', label: 'YYYY-MM-DD' },
  ];

  const handleFormatChange = async (newFormat: 'MDY' | 'DMY' | 'YMD') => {
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/user/date-format', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dateFormat: newFormat }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || t('dateFormatError'));
        setIsSuccess(false);
        return;
      }

      setDateFormat(newFormat);
      setMessage(t('dateFormatSuccess'));
      setIsSuccess(true);
      router.refresh();

      // Clear success message after 2 seconds
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('dateFormatError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        {t('dateFormatDescription')}
      </p>

      <div className="space-y-3">
        {formats.map((format) => (
          <button
            key={format.value}
            onClick={() => handleFormatChange(format.value)}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 border-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              dateFormat === format.value
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
                  {t('dateFormatExample')}: {getDateFormatExample(format.value)}
                </div>
              </div>
              {dateFormat === format.value && (
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
