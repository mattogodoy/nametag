'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

interface CardDavConnectionFormProps {
  userId: string;
  existingConnection: CardDavConnection | null;
}

export default function CardDavConnectionForm({
  userId: _userId,
  existingConnection,
}: CardDavConnectionFormProps) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [provider, setProvider] = useState(existingConnection?.provider || 'custom');
  const [serverUrl, setServerUrl] = useState(existingConnection?.serverUrl || '');
  const [username, setUsername] = useState(existingConnection?.username || '');
  const [password, setPassword] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(existingConnection?.syncEnabled ?? true);
  const [autoExportNew, setAutoExportNew] = useState(existingConnection?.autoExportNew ?? true);
  const [autoSyncInterval, setAutoSyncInterval] = useState(existingConnection?.autoSyncInterval || 300);
  const [importMode, setImportMode] = useState(existingConnection?.importMode || 'manual');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const providerConfig = CARDDAV_PROVIDERS[newProvider];
    if (providerConfig && providerConfig.serverUrl) {
      setServerUrl(providerConfig.serverUrl);
    } else {
      setServerUrl('');
    }
    setTestResult(null);
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
          message: t('testSuccess'),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/carddav/connection', {
        method: existingConnection ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          username,
          password: password || undefined,
          provider: provider !== 'custom' ? provider : null,
          syncEnabled,
          autoExportNew,
          autoSyncInterval,
          importMode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('saveFailed'));
      } else {
        setSuccess(existingConnection ? t('updateSuccess') : t('saveSuccess'));
        router.refresh();
        setPassword(''); // Clear password after successful save
      }
    } catch (_err) {
      setError(t('saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t('disconnectConfirm'))) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/carddav/connection', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || t('disconnectFailed'));
      } else {
        setSuccess(t('disconnectSuccess'));
        router.refresh();
      }
    } catch (_err) {
      setError(t('disconnectError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/carddav/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('syncFailed'));
      } else {
        const pendingImports = data.pendingImports || 0;

        // Build success message
        let message = t('syncSuccess', {
          imported: data.imported || 0,
          exported: data.exported || 0,
          updated: data.updated || 0,
        });

        // Add pending imports message if any
        if (pendingImports > 0) {
          message += ' ' + t('syncPendingImports', { count: pendingImports });
        }

        setSuccess(message);
        router.refresh();
      }
    } catch (_err) {
      setError(t('syncError'));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        {provider !== 'custom' && CARDDAV_PROVIDERS[provider] && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {CARDDAV_PROVIDERS[provider].help}
          </p>
        )}
      </div>

      {/* Server URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('serverUrlLabel')}
        </label>
        <input
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
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
          onChange={(e) => setUsername(e.target.value)}
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
          onChange={(e) => setPassword(e.target.value)}
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

      {/* Sync Settings */}
      {existingConnection && (
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {t('syncSettings')}
          </h3>

          {/* Sync Enabled */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="syncEnabled"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="syncEnabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {t('syncEnabledLabel')}
            </label>
          </div>

          {/* Auto Export New */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoExportNew"
              checked={autoExportNew}
              onChange={(e) => setAutoExportNew(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="autoExportNew" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              {t('autoExportNewLabel')}
            </label>
          </div>

          {/* Sync Interval */}
          <div>
            <label htmlFor="autoSyncInterval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('syncIntervalLabel')}
            </label>
            <select
              id="autoSyncInterval"
              value={autoSyncInterval}
              onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={60}>{t('interval1min')}</option>
              <option value={300}>{t('interval5min')}</option>
              <option value={600}>{t('interval10min')}</option>
              <option value={1800}>{t('interval30min')}</option>
              <option value={3600}>{t('interval1hour')}</option>
              <option value={21600}>{t('interval6hours')}</option>
              <option value={43200}>{t('interval12hours')}</option>
              <option value={86400}>{t('interval24hours')}</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('syncIntervalHelp')}
            </p>
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

          {/* Manual Sync Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !syncEnabled}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSyncing ? t('syncing') : t('syncNow')}
            </button>
            {!syncEnabled && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 text-center">
                {t('syncDisabledWarning')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Test Connection Result */}
      {testResult && (
        <div className={`p-4 rounded-lg ${
          testResult.success
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          <p className="font-medium">
            {testResult.success ? '✓' : '✗'} {testResult.message}
          </p>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
          {success}
        </div>
      )}

      {/* Last Sync Info */}
      {existingConnection && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-medium">{t('status')}:</span>{' '}
            {existingConnection.lastError ? (
              <span className="text-red-600 dark:text-red-400">
                {t('statusError')} - {existingConnection.lastError}
              </span>
            ) : existingConnection.lastSyncAt ? (
              <span className="text-green-600 dark:text-green-400">
                {t('statusConnected')}
              </span>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">
                {t('statusNotSynced')}
              </span>
            )}
          </p>
          {existingConnection.lastSyncAt && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{t('lastSync')}:</span>{' '}
              {new Date(existingConnection.lastSyncAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting || !serverUrl || !username || (!password && !existingConnection)}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isTesting ? t('testing') : t('testConnection')}
        </button>

        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t('saving') : existingConnection ? t('update') : t('save')}
        </button>

        {existingConnection && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('disconnect')}
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
          {t('helpTitle')}
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>{t('helpGoogle')}</li>
          <li>{t('helpIcloud')}</li>
          <li>{t('helpOutlook')}</li>
          <li>{t('helpNextcloud')}</li>
        </ul>
      </div>

      {/* Troubleshooting Tips */}
      {existingConnection && existingConnection.lastError && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
            {t('troubleshootingTitle')}
          </h3>
          <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
            <li>{t('troubleshootingCheckCredentials')}</li>
            <li>{t('troubleshootingCheckUrl')}</li>
            <li>{t('troubleshootingCheckNetwork')}</li>
            <li>{t('troubleshootingCheckAppPassword')}</li>
            <li>{t('troubleshootingTestConnection')}</li>
          </ul>
        </div>
      )}
    </form>
  );
}
