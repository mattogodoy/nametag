'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteRelationshipTypeButtonProps {
  relationshipTypeId: string;
  relationshipTypeName: string;
  usageCount: number;
}

export default function DeleteRelationshipTypeButton({
  relationshipTypeId,
  relationshipTypeName,
  usageCount,
}: DeleteRelationshipTypeButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/relationship-types/${relationshipTypeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete relationship type');
        setIsDeleting(false);
        return;
      }

      // Refresh the page to show updated list
      router.refresh();
    } catch (error) {
      setError('Failed to delete relationship type');
      setIsDeleting(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="btn btn-error btn-xs"
          title="Confirm delete"
        >
          {isDeleting && <span className="loading loading-spinner loading-xs" />}
          {isDeleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => {
            setShowConfirm(false);
            setError('');
          }}
          disabled={isDeleting}
          className="btn btn-ghost btn-xs"
          title="Cancel"
        >
          Cancel
        </button>
        {error && (
          <span className="text-xs text-error">{error}</span>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="btn btn-ghost btn-square btn-sm text-error"
      title="Delete"
    >
      <span className="icon-[tabler--trash] size-4" />
    </button>
  );
}
