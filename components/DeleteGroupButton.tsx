'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmationModal from './ui/ConfirmationModal';

interface DeleteGroupButtonProps {
  groupId: string;
  groupName: string;
}

export default function DeleteGroupButton({
  groupId,
  groupName,
}: DeleteGroupButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/groups');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete group. Please try again.');
        setIsDeleting(false);
      }
    } catch {
      setError('Unable to connect to server. Please check your connection and try again.');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn btn-error flex-1 sm:flex-none"
      >
        <span className="icon-[tabler--trash] size-4" />
        Delete
      </button>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Group"
        confirmText="Delete"
        isLoading={isDeleting}
        loadingText="Deleting..."
        error={error}
        variant="danger"
      >
        <p className="text-base-content/70 mb-1">
          Are you sure you want to delete{' '}
          <strong className="text-base-content">{groupName}</strong>?
        </p>
        <p className="text-base-content/70">
          This will remove all people from this group but will not delete the
          people themselves.
        </p>
      </ConfirmationModal>
    </>
  );
}
