'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmationModal from './ui/ConfirmationModal';
import { Button } from './ui/Button';

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

  const openConfirm = () => {
    setError(null);
    setDeleteOrphans(false);
    setOrphans([]);
    setIsLoadingOrphans(true);
    setShowConfirm(true);
  };

  // Fetch orphans when modal opens
  useEffect(() => {
    if (showConfirm) {
      const controller = new AbortController();

      fetch(`/api/people/${personId}/orphans`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          setOrphans(data.orphans || []);
          setIsLoadingOrphans(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoadingOrphans(false);
        });

      return () => controller.abort();
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
      <Button variant="danger" onClick={openConfirm}>
        Delete
      </Button>

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
        <p className="text-muted mb-1">
          Are you sure you want to delete{' '}
          <strong className="text-foreground">{personName}</strong>?
        </p>
        <p className="text-muted mb-4">
          You can restore deleted items within 30 days.
        </p>

        {isLoadingOrphans && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded text-sm">
            Checking for orphaned people...
          </div>
        )}

        {!isLoadingOrphans && orphans.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">
              <strong>Note:</strong> Deleting this person will leave others without any relationships, showing them as isolated nodes in the network graph:
            </p>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mb-3 space-y-1">
              {orphans.map((orphan) => (
                <li key={orphan.id}>
                  <a
                    href={`/people/${orphan.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {orphan.fullName}
                    <svg
                      className="w-3 h-3 inline"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="deleteOrphans"
                checked={deleteOrphans}
                onChange={(e) => setDeleteOrphans(e.target.checked)}
                className="w-4 h-4 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
              />
              <label
                htmlFor="deleteOrphans"
                className="ml-2 text-sm text-yellow-800 dark:text-yellow-400 cursor-pointer"
              >
                Delete them too
              </label>
            </div>
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}
