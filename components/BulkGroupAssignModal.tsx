'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmationModal from './ui/ConfirmationModal';
import GroupsSelector from './GroupsSelector';

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface BulkGroupAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  totalCount: number;
  availableGroups: Group[];
  onSuccess: () => void;
  onGroupCreated?: (group: Group) => void;
}

export default function BulkGroupAssignModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  totalCount,
  availableGroups,
  onSuccess,
  onGroupCreated,
}: BulkGroupAssignModalProps) {
  const t = useTranslations('people.bulk');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selectAll ? totalCount : selectedIds.length;

  const handleClose = () => {
    setSelectedGroupIds([]);
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (selectedGroupIds.length === 0) {
      setError(t('noGroupsSelected'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addToGroups',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          groupIds: selectedGroupIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('addToGroupsSuccess', { count: data.affectedCount }));
        setSelectedGroupIds([]);
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('addToGroupsFailed'));
        setIsSubmitting(false);
      }
    } catch {
      setError(t('addToGroupsFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t('addToGroupsTitle', { count })}
      confirmText={t('addToGroups')}
      isLoading={isSubmitting}
      loadingText={t('adding')}
      error={error}
      variant="default"
    >
      <p className="text-sm text-muted mb-4">
        {t('addToGroupsDescription')}
      </p>
      <GroupsSelector
        availableGroups={availableGroups}
        selectedGroupIds={selectedGroupIds}
        onChange={setSelectedGroupIds}
        allowCreate={true}
        onGroupCreated={onGroupCreated}
      />
    </ConfirmationModal>
  );
}
