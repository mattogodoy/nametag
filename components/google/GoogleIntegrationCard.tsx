'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type GoogleIntegrationStatus = {
  authMode: string;
  gmailSyncEnabled: boolean;
  driveSyncEnabled: boolean;
  lastGmailSyncAt: string | null;
  lastError: string | null;
  syncInProgress: boolean;
};

interface GoogleIntegrationCardProps {
  integration: GoogleIntegrationStatus | null;
}

export default function GoogleIntegrationCard({ integration }: GoogleIntegrationCardProps) {
  const t = useTranslations('settings.integrations.google');
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [gmailEnabled, setGmailEnabled] = useState(integration?.gmailSyncEnabled ?? false);
  const [driveEnabled, setDriveEnabled] = useState(integration?.driveSyncEnabled ?? false);

  if (!integration) {
    return null;
  }

  // Capture for use in closures where TS cannot narrow the null check above
  const currentIntegration = integration;
  const isConnected = true;

  async function handleSyncNow() {
    setSyncing(true);
    try {
      const res = await fetch('/api/google/gmail/sync', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Sync failed');
      }
      toast.success(t('syncSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('syncError'));
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(t('confirmDisconnect'))) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/google/connect', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Disconnect failed');
      }
      toast.success(t('disconnectSuccess'));
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('disconnectError'));
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleToggle(field: 'gmailSyncEnabled' | 'driveSyncEnabled', value: boolean) {
    try {
      const res = await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authMode: currentIntegration.authMode,
          [field]: value,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Update failed');
      }
      if (field === 'gmailSyncEnabled') setGmailEnabled(value);
      if (field === 'driveSyncEnabled') setDriveEnabled(value);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update setting');
      // Revert the toggle
      if (field === 'gmailSyncEnabled') setGmailEnabled(!value);
      if (field === 'driveSyncEnabled') setDriveEnabled(!value);
    }
  }

  function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  return (
    <div className="border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t('title')}</h3>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isConnected
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {isConnected ? t('connected') : t('disconnected')}
        </span>
      </div>

      {/* Auth mode badge */}
      <div className="mb-4">
        <span className="text-sm text-muted">{t('authMode')}: </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          {integration.authMode === 'oauth' ? t('oauth') : t('serviceAccount')}
        </span>
      </div>

      {/* Sync toggles */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{t('gmailSync')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={gmailEnabled}
            onClick={() => handleToggle('gmailSyncEnabled', !gmailEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              gmailEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                gmailEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">{t('driveSync')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={driveEnabled}
            onClick={() => handleToggle('driveSyncEnabled', !driveEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              driveEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                driveEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Last sync time */}
      <div className="mb-4 text-sm text-muted">
        {t('lastSync')}:{' '}
        {integration.lastGmailSyncAt
          ? formatRelativeDate(integration.lastGmailSyncAt)
          : t('never')}
      </div>

      {/* Error display */}
      {integration.lastError && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">{t('error')}</p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{integration.lastError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSyncNow}
          disabled={syncing || integration.syncInProgress || !gmailEnabled}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing || integration.syncInProgress ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {t('syncing')}
            </>
          ) : (
            t('syncNow')
          )}
        </button>

        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {disconnecting ? t('disconnecting') : t('disconnect')}
        </button>
      </div>
    </div>
  );
}
