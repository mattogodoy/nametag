'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ConfirmationModal from './ui/ConfirmationModal';
import { Button } from './ui/Button';

interface DeleteJournalEntryButtonProps {
  entryId: string;
}

export default function DeleteJournalEntryButton({ entryId }: DeleteJournalEntryButtonProps) {
  const t = useTranslations('journal.detail');
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/journal/${entryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/journal');
        router.refresh();
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

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShowConfirm(true)}>
        {t('deleteButton')}
      </Button>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => { setShowConfirm(false); setError(null); }}
        onConfirm={handleDelete}
        title={t('confirmDelete')}
        confirmText={t('deleteButton')}
        isLoading={isDeleting}
        error={error}
        variant="danger"
      >
        <p className="text-muted">
          {t('confirmDeleteDescription')}
        </p>
      </ConfirmationModal>
    </>
  );
}
