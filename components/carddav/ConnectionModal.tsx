'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CARDDAV_PROVIDERS } from '@/lib/carddav/types';

interface CardDavConnection {
  id: string;
  serverUrl: string;
  username: string;
  provider: string | null;
  syncEnabled: boolean;
  autoExportNew: boolean;
  autoSyncInterval: number;
  importMode: string;
  lastSyncAt: Date | null;
  lastError: string | null;
}

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingConnection: CardDavConnection | null;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  existingConnection,
}: ConnectionModalProps) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [provider, setProvider] = useState(existingConnection?.provider || 'custom');
  const [serverUrl, setServerUrl] = useState(existingConnection?.serverUrl || '');
  const [username, setUsername] = useState(existingConnection?.username || '');
  const [password, setPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes or connection changes
  useEffect(() => {
    if (isOpen) {
      setProvider(existingConnection?.provider || 'custom');
      setServerUrl(existingConnection?.serverUrl || '');
      setUsername(existingConnection?.username || '');
      setPassword('');
      setTestResult(null);
      setError('');
    }
  }, [isOpen, existingConnection]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = CARDDAV_PROVIDERS[newProvider];
    if (providerConfig && providerConfig.serverUrl) {
      setServerUrl(providerConfig.serverUrl);
    } else {
      setServerUrl('');
    }
    setTestResult(null);
    setError('');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError('');
    setTestResult(null);

    try {
      const response = await fetch('/api/carddav/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          username,
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          message: data.error || t('testFailed'),
        });
      } else {
        setTestResult({
          success: true,
          message: t('testSuccessMessage'),
        });
      }
    } catch (_err) {
      setTestResult({
        success: false,
        message: t('testError'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/carddav/connection', {
        method: existingConnection ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          username,
          password: password || undefined,
          provider: provider !== 'custom' ? provider : null,
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

  const isFormComplete = serverUrl && username && (password || existingConnection);
  const canSave = testResult?.success === true && !isSaving;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingConnection ? t('connectionModalEditTitle') : t('connectionModalTitle')}
      size="lg"
    >
      <div className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('providerLabel')}
          </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Object.entries(CARDDAV_PROVIDERS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name}
              </option>
            ))}
            <option value="custom">{t('customProvider')}</option>
          </select>
        </div>

        {/* How to connect instructions (always visible) */}
        {provider !== 'custom' && CARDDAV_PROVIDERS[provider] && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              {t('howToConnect')}
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {CARDDAV_PROVIDERS[provider].help}
            </p>
          </div>
        )}

        {/* Server URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('serverUrlLabel')}
          </label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => {
              setServerUrl(e.target.value);
              setTestResult(null);
            }}
            placeholder="https://carddav.example.com"
            required
            disabled={provider !== 'custom' && provider !== 'nextcloud'}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('usernameLabel')}
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setTestResult(null);
            }}
            placeholder={t('usernamePlaceholder')}
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('passwordLabel')}
            {existingConnection && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({t('leaveBlankToKeep')})
              </span>
            )}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setTestResult(null);
            }}
            placeholder={t('passwordPlaceholder')}
            required={!existingConnection}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {CARDDAV_PROVIDERS[provider]?.requiresAppPassword && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              ⚠️ {t('appPasswordRequired')}
            </p>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-4 rounded-lg ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            <p className="font-medium">
              {testResult.success ? '✓' : '✗'} {testResult.message}
            </p>
          </div>
        )}

        {/* Form validation message */}
        {!isFormComplete && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('fillAllFields')}
            </p>
          </div>
        )}

        {/* Save disabled message */}
        {isFormComplete && !testResult?.success && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('saveDisabledMessage')}
            </p>
          </div>
        )}

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
            onClick={handleTestConnection}
            disabled={!isFormComplete || isTesting}
            className="bg-gray-600 text-white hover:bg-gray-700 border-0"
          >
            {isTesting ? t('testing') : t('testConnection')}
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
          >
            {isSaving ? t('saving') : existingConnection ? t('update') : t('save')}
          </Button>

          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
          >
            {t('cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
