'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface VCardRawDisplayProps {
  rawVCard: string;
}

export default function VCardRawDisplay({ rawVCard }: VCardRawDisplayProps) {
  const t = useTranslations('settings.vcardTest');
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawVCard);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="bg-surface shadow rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t('rawTitle')}</h2>
          <p className="text-sm text-muted mt-1">{t('rawDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            {copied ? t('copied') : t('copyToClipboard')}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-foreground transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto">
            <pre className="p-4 text-sm font-mono text-foreground">
              <code>{rawVCard}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
