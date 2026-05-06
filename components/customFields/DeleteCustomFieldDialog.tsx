'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { TemplateWithCount } from './CustomFieldsManager';

interface DeleteCustomFieldDialogProps {
  template: TemplateWithCount;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteCustomFieldDialog({
  template,
  onConfirm,
  onCancel,
}: DeleteCustomFieldDialogProps) {
  const t = useTranslations('customFields.delete');
  const tErrors = useTranslations('customFields.errors');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/custom-field-templates/${template.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onConfirm();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? tErrors('somethingWentWrong'));
        setIsDeleting(false);
      }
    } catch {
      setError(tErrors('cannotConnect'));
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmationModal
      isOpen
      onClose={onCancel}
      onConfirm={handleConfirm}
      title={t('confirmTitle')}
      confirmText={t('confirmAction')}
      cancelText={t('cancel')}
      isLoading={isDeleting}
      error={error}
      variant="danger"
    >
      <p className="text-muted text-sm">
        {t('confirmBody', { count: template._count.values })}
      </p>
    </ConfirmationModal>
  );
}
