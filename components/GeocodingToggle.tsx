'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface GeocodingToggleProps {
  currentEnabled: boolean;
}

export default function GeocodingToggle({ currentEnabled }: GeocodingToggleProps) {
  const t = useTranslations('settings.map');
  const [enabled, setEnabled] = useState(currentEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleToggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);
    try {
      const response = await fetch('/api/user/geocoding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geocodingEnabled: next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setEnabled(!next);
        setMessage(data.error || t('error'));
        return;
      }
      setMessage(t('success'));
      setIsSuccess(true);
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setEnabled(!next);
      setMessage(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-4 cursor-pointer">
        <span className="text-foreground">{t('geocodingLabel')}</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isLoading}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            enabled ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </label>
      {message && (
        <p className={`text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
