'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConnectionStatus from '@/components/carddav/ConnectionStatus';
import ConnectionModal from '@/components/carddav/ConnectionModal';
import SyncSettingsModal from '@/components/carddav/SyncSettingsModal';
import SyncProgressModal from '@/components/carddav/SyncProgressModal';
import ImportSuccessToast from '@/components/ImportSuccessToast';

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

interface CardDavSettingsProps {
  connection: CardDavConnection | null;
  pendingImportsCount: number;
  syncedContactsCount: number;
}

export default function CardDavSettings({
  connection,
  pendingImportsCount,
  syncedContactsCount,
}: CardDavSettingsProps) {
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const t = useTranslations('settings.carddav');

  return (
    <>
      <ImportSuccessToast redirectPath="/settings/carddav" errorLevel="warning" />

      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{t('betaLabel')}</span>
          {' — '}
          {t('betaBanner')}
        </p>
      </div>

      <ConnectionStatus
        connection={connection}
        pendingImportsCount={pendingImportsCount}
        syncedContactsCount={syncedContactsCount}
        onConnectClick={() => setShowConnectionModal(true)}
        onEditClick={() => setShowConnectionModal(true)}
        onSettingsClick={() => setShowSettingsModal(true)}
        onSyncClick={() => setShowSyncModal(true)}
      />

      {/* Connection Modal (for both create and edit) */}
      <ConnectionModal
        isOpen={showConnectionModal}
        onClose={() => setShowConnectionModal(false)}
        existingConnection={connection}
      />

      {/* Sync Settings Modal */}
      <SyncSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentSettings={connection}
      />

      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
}
