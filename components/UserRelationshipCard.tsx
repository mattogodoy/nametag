'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import { getUserPhotoUrl } from '@/lib/photo-url';

interface RelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
}

interface UserRelationshipCardProps {
  personId: string;
  personName: string;
  relationshipToUser: {
    id: string;
    label: string;
    color: string | null;
  };
  relationshipTypes: RelationshipType[];
  userName?: string;
  userPhoto?: string | null;
}

export default function UserRelationshipCard({
  personId,
  personName,
  relationshipToUser,
  relationshipTypes,
  userName,
  userPhoto,
}: UserRelationshipCardProps) {
  const t = useTranslations('people');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState(relationshipToUser.id);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationshipToUserId: selectedTypeId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to update relationship');
        setIsLoading(false);
        return;
      }

      toast.success(t('relationshipUpdated'));
      setShowEditModal(false);
      router.refresh();
    } catch {
      setError(t('connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationshipToUserId: null,
        }),
      });

      if (response.ok) {
        toast.success(t('relationshipDeleted'));
        setShowDeleteModal(false);
        router.refresh();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete relationship');
      }
    } catch {
      setError(t('connectionError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap text-foreground">
            {(() => {
              const photoUrl = getUserPhotoUrl(userPhoto);
              const initials = (userName || '?').charAt(0).toUpperCase();
              return photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoUrl} alt="" className="w-6 h-6 rounded-full object-cover bg-surface flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-semibold text-muted">{initials}</span>
                </div>
              );
            })()}
            {t.rich('isYourRelationship', {
              name: () => (
                <span className="font-medium">
                  {personName}
                </span>
              ),
              type: () => (
                <span
                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: relationshipToUser.color
                      ? `${relationshipToUser.color}20`
                      : 'var(--badge-bg)',
                    color: relationshipToUser.color || 'var(--badge-text)',
                  }}
                >
                  {relationshipToUser.label}
                </span>
              ),
            })}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setSelectedTypeId(relationshipToUser.id);
                setError('');
                setShowEditModal(true);
              }}
              className="text-primary hover:text-primary-dark transition-colors"
              title={t('edit')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => {
                setError('');
                setShowDeleteModal(true);
              }}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
              title={t('delete')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('editYourRelationship', { name: personName })}
            </h3>
            <form onSubmit={handleEdit} className="space-y-4">
              {error && (
                <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('relationshipType')} *
                </label>
                <select
                  required
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? t('saving') : t('saveChanges')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('deleteRelationship')}
            </h3>
            <p className="text-muted mb-6">
              {t('deleteYourRelationshipConfirm', { name: personName })}
            </p>

            {error && (
              <div role="alert" className="mb-4 p-3 bg-warning/10 border border-warning/30 text-warning rounded text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={isLoading}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={isLoading}
              >
                {isLoading ? t('deleting') : t('delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
