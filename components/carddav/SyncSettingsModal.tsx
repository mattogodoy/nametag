'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface CardDavConnection {
  id: string;
  syncEnabled: boolean;
  autoExportNew: boolean;
  autoSyncInterval: number;
  importMode: string;
}

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: CardDavConnection | null;
}

export default function SyncSettingsModal({
  isOpen,
  onClose,
  currentSettings,
}: SyncSettingsModalProps) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [syncEnabled, setSyncEnabled] = useState(currentSettings?.syncEnabled ?? true);
  const [autoExportNew, setAutoExportNew] = useState(currentSettings?.autoExportNew ?? true);
  const [importMode, setImportMode] = useState(currentSettings?.importMode || 'manual');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');


  // Reset form when modal opens or settings change
  useEffect(() => {
    if (isOpen && currentSettings) {
      setSyncEnabled(currentSettings.syncEnabled);
      setAutoExportNew(currentSettings.autoExportNew);
      setImportMode(currentSettings.importMode);
      setError('');
    }
  }, [isOpen, currentSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/carddav/connection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncEnabled,
          autoExportNew,
          importMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('saveFailed'));
      } else {
        router.refresh();
        onClose();
      }
    } catch (_err) {
      setError(t('saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('settingsModalTitle')}
        size="md"
      >
        <div className="space-y-6">
          <p className="text-sm text-muted">
            {t('settingsModalDescription')}
          </p>

          {/* Sync Enabled */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="syncEnabled"
                checked={syncEnabled}
                onChange={(e) => setSyncEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="syncEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('syncEnabledLabel')}
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('syncEnabledHelp')}
              </p>
            </div>
          </div>

          {/* Auto Export New */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id="autoExportNew"
                checked={autoExportNew}
                onChange={(e) => setAutoExportNew(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
            </div>
            <div className="ml-3">
              <label htmlFor="autoExportNew" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('autoExportNewLabel')}
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('autoExportNewHelp')}
              </p>
            </div>
          </div>

          {/* Import Mode */}
          <div>
            <label htmlFor="importMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('importModeLabel')}
            </label>
            <select
              id="importMode"
              value={importMode}
              onChange={(e) => setImportMode(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="manual">{t('importModeManual')}</option>
              <option value="notify">{t('importModeNotify')}</option>
              <option value="auto">{t('importModeAuto')}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('importModeHelp')}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? t('saving') : t('saveSettings')}
            </Button>

            <Button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              variant="secondary"
            >
              {t('cancel')}
            </Button>
          </div>

        </div>
      </Modal>
  );
}
