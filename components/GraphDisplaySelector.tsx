'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Mode = 'auto' | 'individuals' | 'bubbles';

interface Props {
  currentMode: Mode;
  currentThreshold: number;
}

export default function GraphDisplaySelector({ currentMode, currentThreshold }: Props) {
  const t = useTranslations('settings.appearance');
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(currentMode);
  const [threshold, setThreshold] = useState<number>(currentThreshold);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const options: Array<{ value: Mode; label: string }> = [
    { value: 'auto',        label: t('graphModeAuto') },
    { value: 'individuals', label: t('graphModeIndividuals') },
    { value: 'bubbles',     label: t('graphModeBubbles') },
  ];

  const persist = async (nextMode: Mode, nextThreshold: number) => {
    setIsLoading(true);
    setMessage('');
    setIsSuccess(false);
    try {
      const body: Record<string, unknown> = {};
      body.graphMode = nextMode === 'auto' ? null : nextMode;
      body.graphBubbleThreshold = nextThreshold;
      const response = await fetch('/api/user/graph-display', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const handleMode = async (next: Mode) => {
    setMode(next);
    await persist(next, threshold);
  };

  const handleThresholdCommit = async () => {
    const clamped = Math.max(10, Math.min(500, threshold));
    setThreshold(clamped);
    await persist(mode, clamped);
  };

  const thresholdDisabled = mode !== 'auto';

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

      <div className={thresholdDisabled ? 'opacity-50' : ''}>
        <label className="block text-sm text-muted mb-2">
          {t('graphThresholdLabel')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={500}
            value={threshold}
            disabled={thresholdDisabled || isLoading}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)}
            onBlur={handleThresholdCommit}
            className="w-24 px-3 py-2 border border-border rounded-md bg-surface text-foreground"
          />
          <span className="text-sm text-muted">{t('graphThresholdSuffix')}</span>
        </div>
        <p className="text-xs text-muted mt-2">{t('graphThresholdDescription')}</p>
      </div>

      {message && (
        <p className={`text-sm ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
