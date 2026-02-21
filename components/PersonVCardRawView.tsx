'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { personToVCard } from '@/lib/vcard';
import { copyToClipboard } from '@/lib/vcard-helpers';
import type { PersonWithRelations } from '@/lib/carddav/types';

interface PersonVCardRawViewProps {
  person: PersonWithRelations;
}

export default function PersonVCardRawView({ person }: PersonVCardRawViewProps) {
  const t = useTranslations('people');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const vcard = useMemo(() => personToVCard(person, {
    includePhoto: false, // Skip photo for raw view
    includeCustomFields: true,
    stripMarkdown: false,
  }), [person]);

  // Only render in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleCopy = async () => {
    try {
      await copyToClipboard(vcard);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy vCard:', error);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-muted/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            {t('rawVcard')}
            <span className="text-xs font-normal text-muted px-2 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 rounded">
              DEV
            </span>
          </h3>
          <p className="text-sm text-muted mt-1">
            {t('rawVcardDescription')}
          </p>
        </div>
        {isExpanded ? (
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              {isCopied ? (
                <>
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('vcardCopied')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  {t('copyVcard')}
                </>
              )}
            </button>
          </div>

          <pre className="bg-background border border-border rounded-lg p-4 overflow-x-auto text-xs font-mono text-foreground whitespace-pre">
            {vcard}
          </pre>
        </div>
      )}
    </div>
  );
}
