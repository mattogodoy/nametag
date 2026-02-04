'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { notFound } from 'next/navigation';
import VCardUploader from './VCardUploader';
import VCardRawDisplay from './VCardRawDisplay';
import VCardPreview from './VCardPreview';
import type { ParsedVCardDataEnhanced } from '@/lib/carddav/vcard-parser';

export default function VCardTestPage() {
  const t = useTranslations('settings.vcardTest');

  // Reject in production
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  const [rawVCard, setRawVCard] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedVCardDataEnhanced | null>(null);
  const [error, setError] = useState<string>('');

  const handleVCardUploaded = (vCardText: string, parsed: ParsedVCardDataEnhanced) => {
    setRawVCard(vCardText);
    setParsedData(parsed);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setRawVCard('');
    setParsedData(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="mt-2 text-muted">{t('pageDescription')}</p>
      </div>

      {/* Upload Section */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t('upload')}</h2>
        <p className="text-sm text-muted mb-4">{t('uploadDescription')}</p>
        <VCardUploader onVCardUploaded={handleVCardUploaded} onError={handleError} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Raw vCard Display */}
      {rawVCard && <VCardRawDisplay rawVCard={rawVCard} />}

      {/* Parsed Data Preview */}
      {parsedData && <VCardPreview parsedData={parsedData} />}
    </div>
  );
}
