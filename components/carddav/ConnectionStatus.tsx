'use client';

import { useTranslations } from 'next-intl';
import EmptyState from '@/components/EmptyState';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/date-format';

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

interface ConnectionStatusProps {
  connection: CardDavConnection | null;
  pendingImportsCount: number;
  syncedContactsCount: number;
  onConnectClick: () => void;
  onEditClick: () => void;
  onSettingsClick: () => void;
  onSyncClick: () => void;
}

export default function ConnectionStatus({
  connection,
  pendingImportsCount,
  syncedContactsCount,
  onConnectClick,
  onEditClick,
  onSettingsClick,
  onSyncClick,
}: ConnectionStatusProps) {
  const t = useTranslations('settings.carddav');

  // Show empty state when no connection
  if (!connection) {
    return (
      <div className="bg-surface shadow rounded-lg p-6">
        <EmptyState
          icon={
            <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg
                className="w-12 h-12 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                />
              </svg>
            </div>
          }
          title={t('emptyStateTitle')}
          description={t('emptyStateDescription')}
        />
        <div className="flex justify-center mt-6">
          <Button onClick={onConnectClick}>
            {t('emptyStateAction')}
          </Button>
        </div>
      </div>
    );
  }

  // Determine status
  const getStatus = () => {
    if (connection.lastError) {
      return {
        label: t('statusError'),
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
      };
    } else if (connection.lastSyncAt) {
      return {
        label: t('statusConnected'),
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-100 dark:bg-green-900/20',
      };
    } else {
      return {
        label: t('statusNotSynced'),
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
      };
    }
  };

  const status = getStatus();

  return (
    <div className="bg-surface shadow rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {t('connectionStatusTitle')}
          </h2>
          <p className="text-sm text-muted mt-1">
            {connection.provider ? connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1) : 'Custom'} • {connection.username}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
          {status.label}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-muted mb-1">{t('syncedContacts', { count: syncedContactsCount })}</p>
          <p className="text-2xl font-bold text-foreground">{syncedContactsCount}</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-muted mb-1">
            {connection.lastSyncAt ? t('lastSyncedAt') : t('neverSynced')}
          </p>
          {connection.lastSyncAt && (
            <p className="text-sm text-foreground">
              {formatDateTime(connection.lastSyncAt)}
            </p>
          )}
        </div>
      </div>

      {/* Pending imports notice */}
      {pendingImportsCount > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {t('pendingImportsLink', { count: pendingImportsCount })}
          </p>
          <Link
            href="/carddav/import"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1 inline-block"
          >
            {t('viewPendingImports')} →
          </Link>
        </div>
      )}

      {/* Error notice */}
      {connection.lastError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
            {t('statusError')}
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            {connection.lastError}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onSyncClick}
          disabled={!connection.syncEnabled}
          className="bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-green-600/50"
        >
          {t('syncNow')}
        </Button>
        <Button
          onClick={onSettingsClick}
          variant="secondary"
        >
          {t('settingsButton')}
        </Button>
        <Button
          onClick={onEditClick}
          variant="secondary"
        >
          {t('editConnection')}
        </Button>
      </div>

      {!connection.syncEnabled && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          ⚠️ {t('syncDisabledWarning')}
        </p>
      )}
    </div>
  );
}
