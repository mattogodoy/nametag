'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmationModal from './ui/ConfirmationModal';

interface Orphan {
  id: string;
  fullName: string;
}

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  selectedNames: string[];
  totalCount: number;
  onSuccess: () => void;
}

export default function BulkDeleteModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  selectedNames,
  totalCount,
  onSuccess,
}: BulkDeleteModalProps) {
  const t = useTranslations('people.bulk');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [deleteOrphans, setDeleteOrphans] = useState(false);
  const [deleteFromCardDav, setDeleteFromCardDav] = useState(false);
  const [hasCardDavSync, setHasCardDavSync] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDeleteOrphans(false);
      setDeleteFromCardDav(false);
      setOrphans([]);
      setIsLoadingOrphans(true);

      const controller = new AbortController();

      fetch('/api/people/bulk/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectAll ? { selectAll: true } : { personIds: selectedIds }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          setOrphans(data.orphans || []);
          setHasCardDavSync(data.hasCardDavSync || false);
          setIsLoadingOrphans(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoadingOrphans(false);
        });

      return () => controller.abort();
    }
  }, [isOpen, selectedIds, selectAll]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          deleteOrphans,
          orphanIds: orphans.map((o) => o.id),
          deleteFromCardDav,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('deleteFailed'));
        setIsDeleting(false);
      }
    } catch {
      setError(t('deleteFailed'));
      setIsDeleting(false);
    }
  };

  const count = selectAll ? totalCount : selectedIds.length;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title={t('deleteTitle', { count })}
      confirmText={t('delete')}
      confirmDisabled={isLoadingOrphans}
      isLoading={isDeleting}
      loadingText={t('deleting')}
      error={error}
      variant="danger"
    >
      <p className="text-muted mb-2">
        {t('deleteConfirm', { count })}
      </p>

      {selectedNames.length <= 20 && (
        <ul className="text-sm text-muted list-disc list-inside mb-3 max-h-32 overflow-y-auto">
          {selectedNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted mb-4">
        {t('canRestoreWithin30Days')}
      </p>

      {isLoadingOrphans && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded text-sm">
          {t('checkingOrphans')}
        </div>
      )}

      {!isLoadingOrphans && orphans.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 rounded">
          <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">
            {t('deleteOrphansFound', { count: orphans.length })}
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mb-3 space-y-1 max-h-32 overflow-y-auto">
            {orphans.map((orphan) => (
              <li key={orphan.id}>
                <a
                  href={`/people/${orphan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {orphan.fullName}
                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="bulkDeleteOrphans"
              checked={deleteOrphans}
              onChange={(e) => setDeleteOrphans(e.target.checked)}
              className="w-4 h-4 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
            />
            <label htmlFor="bulkDeleteOrphans" className="ml-2 text-sm text-yellow-800 dark:text-yellow-400 cursor-pointer">
              {t('deleteToo')}
            </label>
          </div>
        </div>
      )}

      {hasCardDavSync && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 rounded">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="bulkDeleteFromCardDav"
              checked={deleteFromCardDav}
              onChange={(e) => setDeleteFromCardDav(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
            />
            <label htmlFor="bulkDeleteFromCardDav" className="ml-2 text-sm text-blue-800 dark:text-blue-400 cursor-pointer">
              {t('deleteFromCardDav')}
            </label>
          </div>
          <p className="ml-6 mt-1 text-xs text-blue-700 dark:text-blue-300">
            {t('deleteFromCardDavDescription')}
          </p>
        </div>
      )}
    </ConfirmationModal>
  );
}
