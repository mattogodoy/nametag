'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncResult {
  imported: number;
  exported: number;
  updatedLocally: number;
  updatedRemotely: number;
  conflicts: number;
  errors: number;
  pendingImports: number;
}

export default function SyncProgressModal({
  isOpen,
  onClose,
}: SyncProgressModalProps) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');

  // Auto-start sync when modal opens
  useEffect(() => {
    if (isOpen && !isSyncing && !syncResult && !error) {
      performSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsSyncing(false);
      setSyncResult(null);
      setError('');
    }
  }, [isOpen]);

  const performSync = async () => {
    setIsSyncing(true);
    setError('');
    setSyncResult(null);

    try {
      const response = await fetch('/api/carddav/sync', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('syncFailed'));
      } else {
        setSyncResult({
          imported: Number(data.imported) || 0,
          exported: Number(data.exported) || 0,
          updatedLocally: Number(data.updatedLocally) || 0,
          updatedRemotely: Number(data.updatedRemotely) || 0,
          conflicts: Number(data.conflicts) || 0,
          errors: Number(data.errors) || 0,
          pendingImports: Number(data.pendingImports) || 0,
        });
        router.refresh();
      }
    } catch (_err) {
      setError(t('syncError'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isSyncing ? t('syncProgressTitle') : error ? t('syncFailedTitle') : t('syncCompleteTitle')}
      size="md"
    >
      <div className="space-y-6">
        {/* Syncing state */}
        {isSyncing && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-muted">
              {t('syncInProgress')}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !isSyncing && (
          <div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium mb-2">{t('syncErrorMessage')}</p>
              <p className="text-sm">{error}</p>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}

        {/* Success state */}
        {syncResult && !isSyncing && !error && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {t('syncResults')}
              </h3>

              <div className="space-y-3">
                {/* Imported */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('importedCount', { count: syncResult.imported })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('importedTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.imported}</span>
                </div>

                {/* Exported */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('exportedCount', { count: syncResult.exported })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('exportedTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.exported}</span>
                </div>

                {/* Updated locally (from server) */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('updatedLocallyCount', { count: syncResult.updatedLocally })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('updatedLocallyTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.updatedLocally}</span>
                </div>

                {/* Updated remotely (to server) */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('updatedRemotelyCount', { count: syncResult.updatedRemotely })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('updatedRemotelyTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.updatedRemotely}</span>
                </div>

                {/* Conflicts */}
                {syncResult.conflicts > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                      {t('conflictsDetected', { count: syncResult.conflicts })}
                    </p>
                    <Link
                      href="/carddav/conflicts"
                      className="text-sm text-amber-700 dark:text-amber-300 hover:underline font-medium"
                    >
                      {t('viewConflictsButton')} →
                    </Link>
                  </div>
                )}

                {/* Pending imports */}
                {syncResult.pendingImports > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {t('syncPendingImports', { count: syncResult.pendingImports })}
                    </p>
                    <Link
                      href="/carddav/import"
                      className="text-sm text-blue-700 dark:text-blue-300 hover:underline font-medium"
                    >
                      {t('viewPendingButton')} →
                    </Link>
                  </div>
                )}

                {/* Errors */}
                {syncResult.errors > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-900 dark:text-red-100">
                      {t('errorsOccurred', { count: syncResult.errors })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
