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
        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
      >
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
        <p className="text-gray-600 dark:text-gray-400 mb-1">
          Are you sure you want to delete{' '}
          <strong className="text-gray-900 dark:text-white">{personName}</strong>?
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          This action cannot be undone.
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
                className="w-4 h-4 text-red-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-red-500"
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
