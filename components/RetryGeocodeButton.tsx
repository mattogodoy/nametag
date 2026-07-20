'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface RetryGeocodeButtonProps {
  addressId: string;
}

export default function RetryGeocodeButton({ addressId }: RetryGeocodeButtonProps) {
  const t = useTranslations('people');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRetry = async () => {
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);
    try {
      const response = await fetch('/api/map/geocode-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId }),
      });
      const data = await response.json();
      if (response.ok && data.outcome === 'success') {
        setMessage(t('retryGeocodeSuccess'));
        setIsSuccess(true);
        router.refresh();
      } else {
        setMessage(t('retryGeocodeFailed'));
      }
    } catch {
      setMessage(t('retryGeocodeFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isLoading}
        className="text-sm text-primary hover:text-primary-dark transition-colors disabled:opacity-50"
      >
        {isLoading ? t('retryGeocodeLoading') : t('retryGeocode')}
      </button>
      {message && (
        <span
          className={`text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
          role="status"
        >
          {message}
        </span>
      )}
    </span>
  );
}
