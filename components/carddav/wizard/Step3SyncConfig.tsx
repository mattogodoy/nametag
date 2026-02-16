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
          <p className="mt-1 text-xs text-muted">
            {t('syncEnabledHelp')}
          </p>
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
