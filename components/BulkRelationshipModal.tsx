'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmationModal from './ui/ConfirmationModal';

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface BulkRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  totalCount: number;
  relationshipTypes: RelationshipType[];
  onSuccess: () => void;
}

export default function BulkRelationshipModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  totalCount,
  relationshipTypes,
  onSuccess,
}: BulkRelationshipModalProps) {
  const t = useTranslations('people.bulk');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selectAll ? totalCount : selectedIds.length;

  const handleClose = () => {
    setSelectedTypeId('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedTypeId) {
      setError(t('noRelationshipSelected'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setRelationship',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          relationshipTypeId: selectedTypeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('setRelationshipSuccess', { count: data.affectedCount }));
        setSelectedTypeId('');
        setIsSubmitting(false);
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('setRelationshipFailed'));
        setIsSubmitting(false);
      }
    } catch {
      setError(t('setRelationshipFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t('setRelationshipTitle', { count })}
      confirmText={t('setRelationship')}
      isLoading={isSubmitting}
      loadingText={t('applying')}
      error={error}
      variant="default"
    >
      <p className="text-sm text-muted mb-4">
        {t('setRelationshipDescription')}
      </p>
      <select
        value={selectedTypeId}
        onChange={(e) => {
          setSelectedTypeId(e.target.value);
          setError(null);
        }}
        className="w-full px-3 py-2 border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
      >
        <option value="">{t('selectRelationshipType')}</option>
        {relationshipTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.label}
          </option>
        ))}
      </select>
    </ConfirmationModal>
  );
}
