'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmationModal from './ui/ConfirmationModal';

interface DeletePersonButtonProps {
  personId: string;
  personName: string;
}

interface Orphan {
  id: string;
  fullName: string;
}

export default function DeletePersonButton({
  personId,
  personName,
}: DeletePersonButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [deleteOrphans, setDeleteOrphans] = useState(false);

  // Fetch orphans when modal opens
  useEffect(() => {
    if (showConfirm) {
      setIsLoadingOrphans(true);
      fetch(`/api/people/${personId}/orphans`)
        .then((res) => res.json())
        .then((data) => {
          setOrphans(data.orphans || []);
          setIsLoadingOrphans(false);
        })
        .catch(() => {
          setIsLoadingOrphans(false);
        });
    }
  }, [showConfirm, personId]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deleteOrphans,
          orphanIds: orphans.map((o) => o.id),
        }),
      });

      if (response.ok) {
        router.push('/people');
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete person. Please try again.');
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
        title="Delete Person"
        confirmText="Delete"
        confirmDisabled={isLoadingOrphans}
        isLoading={isDeleting}
        loadingText="Deleting..."
        error={error}
        variant="danger"
      >
        <p className="text-base-content/70 mb-1">
          Are you sure you want to delete{' '}
          <strong className="text-base-content">{personName}</strong>?
        </p>
        <p className="text-base-content/70 mb-4">
          This action cannot be undone.
        </p>

        {isLoadingOrphans && (
          <div className="alert alert-info">
            <span className="icon-[tabler--loader-2] size-4 animate-spin" />
            <span>Checking for orphaned people...</span>
          </div>
        )}

        {!isLoadingOrphans && orphans.length > 0 && (
          <div className="alert alert-warning">
            <div className="flex flex-col gap-2 w-full">
              <p className="text-sm">
                <strong>Note:</strong> Deleting this person will leave others without any relationships, showing them as isolated nodes in the network graph:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1">
                {orphans.map((orphan) => (
                  <li key={orphan.id}>
                    <a
                      href={`/people/${orphan.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-hover inline-flex items-center gap-1"
                    >
                      {orphan.fullName}
                      <span className="icon-[tabler--external-link] size-3" />
                    </a>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="deleteOrphans"
                  checked={deleteOrphans}
                  onChange={(e) => setDeleteOrphans(e.target.checked)}
                  className="checkbox checkbox-sm checkbox-error"
                />
                <span className="text-sm">Delete them too</span>
              </label>
            </div>
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}
