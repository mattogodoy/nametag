'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Mode = 'individuals' | 'bubbles';

interface Props {
  currentMode: Mode;
}

export default function GraphDisplaySelector({ currentMode }: Props) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(currentMode);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const options: Array<{ value: Mode; label: string }> = [
    { value: 'individuals', label: t('graphModeIndividuals') },
    { value: 'bubbles',     label: t('graphModeBubbles') },
  ];

  const handleMode = async (next: Mode) => {
    setMode(next);
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);
    try {
      const response = await fetch('/api/user/graph-display', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphMode: next }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || t('graphDisplayError'));
        return;
      }
      setMessage(t('graphDisplaySuccess'));
      setIsSuccess(true);
      router.refresh();
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage(t('graphDisplayError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleMode(opt.value)}
            disabled={isLoading}
            className={`w-full text-left px-4 py-3 border-2 rounded-lg transition-colors disabled:opacity-50 ${
              mode === opt.value
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="font-medium text-foreground">{opt.label}</div>
          </button>
        ))}
      </div>

      {message && (
        <p className={`text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
