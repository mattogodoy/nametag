'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '../ui/Button';

interface ApplyPromoFormProps {
  hasActivePromo: boolean;
}

export default function ApplyPromoForm({ hasActivePromo }: ApplyPromoFormProps) {
  const t = useTranslations('settings.billing');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper function to translate known error messages from the server
  const translateError = (errorMessage: string): string => {
    const errorMap: Record<string, string> = {
      'Invalid promotion code': t('promoErrors.invalidCode'),
      'This promotion is no longer active': t('promoErrors.notActive'),
      'This promotion has reached its redemption limit': t('promoErrors.reachedLimit'),
      'This promotion is not yet active': t('promoErrors.notYetActive'),
      'This promotion has expired': t('promoErrors.expired'),
      'You already have an active promotion': t('promoErrors.alreadyHavePromo'),
    };

    return errorMap[errorMessage] || errorMessage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/billing/apply-promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(t('promoSuccess'));
        setCode('');
        router.refresh();
      } else {
        setError(translateError(data.error) || t('promoError'));
      }
    } catch {
      setError(t('promoErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  if (hasActivePromo) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="promo-code" className="block text-sm font-medium text-muted">
          {t('promoCode')}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type="text"
            id="promo-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('promoCodePlaceholder')}
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-surface text-foreground placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <Button
            type="submit"
            disabled={loading || !code.trim()}
          >
            {loading ? t('applying') : t('applyCode')}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
      )}
    </form>
  );
}
