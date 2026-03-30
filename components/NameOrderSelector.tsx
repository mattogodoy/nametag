'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface NameOrderSelectorProps {
  currentOrder: 'WESTERN' | 'EASTERN';
}

export default function NameOrderSelector({ currentOrder }: NameOrderSelectorProps) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [nameOrder, setNameOrder] = useState(currentOrder);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const orders: Array<{ value: 'WESTERN' | 'EASTERN'; label: string; description: string }> = [
    { value: 'WESTERN', label: t('nameOrderWestern'), description: t('nameOrderWesternDescription') },
    { value: 'EASTERN', label: t('nameOrderEastern'), description: t('nameOrderEasternDescription') },
  ];

  const handleOrderChange = async (newOrder: 'WESTERN' | 'EASTERN') => {
    if (newOrder === nameOrder) return;
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);

    try {
      const response = await fetch('/api/user/name-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nameOrder: newOrder }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || t('nameOrderError'));
        setIsSuccess(false);
        return;
      }

      setNameOrder(newOrder);
      setMessage(t('nameOrderSuccess'));
      setIsSuccess(true);
      router.refresh();

      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('nameOrderError'));
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="space-y-3">
        {orders.map((order) => (
          <button
            key={order.value}
            onClick={() => handleOrderChange(order.value)}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 border-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              nameOrder === order.value
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-foreground">
                  {order.label}
                </div>
                <div className="text-sm text-muted">
                  {order.description}
                </div>
              </div>
              {nameOrder === order.value && (
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
