'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { WizardData } from './Step1ServerConfig';

interface Step3SyncConfigProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onBack: () => void;
  onClose: () => void;
}

const SYNC_INTERVALS = [
  { value: 60, key: 'interval1min' },
  { value: 300, key: 'interval5min' },
  { value: 600, key: 'interval10min' },
  { value: 1800, key: 'interval30min' },
  { value: 3600, key: 'interval1hour' },
  { value: 21600, key: 'interval6hours' },
  { value: 43200, key: 'interval12hours' },
  { value: 86400, key: 'interval24hours' },
] as const;

export default function Step3SyncConfig({
  data,
  onUpdate,
  onBack,
  onClose,
}: Step3SyncConfigProps) {
  const t = useTranslations('settings.carddav');
  const tw = useTranslations('settings.carddav.wizard');
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/carddav/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: data.serverUrl,
          username: data.username,
          password: data.password,
          provider: data.provider !== 'custom' ? data.provider : null,
          syncEnabled: data.syncEnabled,
          autoSyncInterval: data.autoSyncInterval,
          autoExportNew: true,
          importMode: 'manual',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t('saveFailed'));
      } else {
        router.refresh();
        onClose();
      }
    } catch {
      setError(t('saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {tw('syncConfigDescription')}
      </p>

      {/* Sync toggle */}
      <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-lg border border-border">
        <div>
          <label htmlFor="sync-enabled" className="text-sm font-medium text-foreground">
            {t('syncEnabledLabel')}
          </label>
        </div>
        <button
          id="sync-enabled"
          type="button"
          role="switch"
          aria-checked={data.syncEnabled}
          onClick={() => onUpdate({ syncEnabled: !data.syncEnabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            data.syncEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              data.syncEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Sync explanation */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {tw('syncExplanation')}
        </p>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {tw('manualSyncExplanation')}
        </p>
      </div>

      {data.syncEnabled && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('syncIntervalLabel')}
          </label>
          <select
            value={data.autoSyncInterval}
            onChange={(e) => onUpdate({ autoSyncInterval: parseInt(e.target.value, 10) })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {SYNC_INTERVALS.map(({ value, key }) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Can change later note */}
      <p className="text-xs text-muted">
        {tw('canChangeLater')}
      </p>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button type="button" onClick={onBack} variant="secondary" disabled={isSaving}>
          {tw('back')}
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? tw('savingConnection') : t('save')}
        </Button>
      </div>
    </div>
  );
}
