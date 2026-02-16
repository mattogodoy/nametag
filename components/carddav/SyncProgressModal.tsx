'use client';

import { useState, useEffect, useRef } from 'react';
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

interface SyncProgress {
  phase: 'pull' | 'push';
  step: 'connecting' | 'fetching' | 'processing';
  current?: number;
  total?: number;
  contact?: string;
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
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
      setProgress(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  const performSync = async () => {
    setIsSyncing(true);
    setError('');
    setSyncResult(null);
    setProgress(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/carddav/sync', {
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        try {
          const data = await response.json();
          setError(data.error || t('syncFailed'));
        } catch {
          setError(t('syncFailed'));
        }
        setIsSyncing(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError(t('syncError'));
        setIsSyncing(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const events = buffer.split('\n\n');
        // Keep the last incomplete chunk in the buffer
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const lines = eventBlock.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (!eventType || !eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            if (eventType === 'progress') {
              setProgress(parsed as SyncProgress);
            } else if (eventType === 'complete') {
              setSyncResult({
                imported: Number(parsed.imported) || 0,
                exported: Number(parsed.exported) || 0,
                updatedLocally: Number(parsed.updatedLocally) || 0,
                updatedRemotely: Number(parsed.updatedRemotely) || 0,
                conflicts: Number(parsed.conflicts) || 0,
                errors: Number(parsed.errors) || 0,
                pendingImports: Number(parsed.pendingImports) || 0,
              });
              router.refresh();
            } else if (eventType === 'error') {
              setError(parsed.error || t('syncFailed'));
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Modal was closed, ignore
      }
      setError(t('syncError'));
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  };

  const getProgressMessage = (): string => {
    if (!progress) return t('syncInProgress');

    if (progress.step === 'connecting') {
      return t('syncConnecting');
    }

    if (progress.step === 'fetching') {
      if (progress.phase === 'pull') return t('syncFetchingContacts');
      return t('syncPushingChanges');
    }

    if (progress.step === 'processing' && progress.current != null && progress.total != null) {
      if (progress.phase === 'pull') {
        return t('syncProcessingPull', { current: progress.current, total: progress.total });
      }
      return t('syncProcessingPush', { current: progress.current, total: progress.total });
    }

    return t('syncInProgress');
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
              {getProgressMessage()}
            </p>
            {progress?.step === 'processing' && progress.contact && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 truncate max-w-xs mx-auto">
                {progress.contact}
              </p>
            )}
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
