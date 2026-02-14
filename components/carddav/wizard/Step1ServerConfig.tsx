'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CARDDAV_PROVIDERS } from '@/lib/carddav/types';

export interface WizardData {
  provider: string;
  serverUrl: string;
  username: string;
  password: string;
  testPassed: boolean;
  backupDownloaded: boolean;
  syncEnabled: boolean;
  autoSyncInterval: number;
}

interface Step1ServerConfigProps {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function Step1ServerConfig({
  data,
  onUpdate,
  onNext,
  onCancel,
}: Step1ServerConfigProps) {
  const t = useTranslations('settings.carddav');
  const tw = useTranslations('settings.carddav.wizard');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(
    data.testPassed ? { success: true, message: t('testSuccessMessage') } : null
  );

  const handleProviderChange = (newProvider: string) => {
    const providerConfig = CARDDAV_PROVIDERS[newProvider];
    onUpdate({
      provider: newProvider,
      serverUrl: providerConfig?.serverUrl || '',
      testPassed: false,
      backupDownloaded: false,
    });
    setTestResult(null);
  };

  const handleCredentialChange = (field: 'serverUrl' | 'username' | 'password', value: string) => {
    onUpdate({
      [field]: value,
      testPassed: false,
      backupDownloaded: false,
    });
    setTestResult(null);
  };

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const normalizedUrl = normalizeUrl(data.serverUrl);
    onUpdate({ serverUrl: normalizedUrl });

    try {
      const response = await fetch('/api/carddav/connection/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: normalizedUrl,
          username: data.username,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setTestResult({
          success: false,
          message: result.error || t('testFailed'),
        });
      } else {
        setTestResult({
          success: true,
          message: t('testSuccessMessage'),
        });
        onUpdate({ testPassed: true });
      }
    } catch {
      setTestResult({
        success: false,
        message: t('testError'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isFormComplete = data.serverUrl && data.username && data.password;

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('providerLabel')}
        </label>
        <select
          value={data.provider}
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

      {/* Server URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('serverUrlLabel')}
        </label>
        <input
          type="url"
          value={data.serverUrl}
          onChange={(e) => handleCredentialChange('serverUrl', e.target.value)}
          placeholder="https://carddav.example.com"
          required
          disabled={data.provider !== 'custom'}
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
          value={data.username}
          onChange={(e) => handleCredentialChange('username', e.target.value)}
          placeholder={t('usernamePlaceholder')}
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('passwordLabel')}
        </label>
        <input
          type="password"
          value={data.password}
          onChange={(e) => handleCredentialChange('password', e.target.value)}
          placeholder={t('passwordPlaceholder')}
          required
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {CARDDAV_PROVIDERS[data.provider]?.requiresAppPassword && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            {t('appPasswordRequired')}
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
            {testResult.success ? '\u2713' : '\u2717'} {testResult.message}
          </p>
        </div>
      )}

      {/* Info messages */}
      {!isFormComplete && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('fillAllFields')}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button type="button" onClick={onCancel} variant="secondary">
          {t('cancel')}
        </Button>
        <div className="flex gap-3">
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
            onClick={onNext}
            disabled={!data.testPassed}
          >
            {tw('next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
