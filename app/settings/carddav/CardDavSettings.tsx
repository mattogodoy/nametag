'use client';

import { useState } from 'react';
import ConnectionStatus from '@/components/carddav/ConnectionStatus';
import ConnectionModal from '@/components/carddav/ConnectionModal';
import SyncSettingsModal from '@/components/carddav/SyncSettingsModal';
import SyncProgressModal from '@/components/carddav/SyncProgressModal';

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

  return (
    <>
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
