'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import PersonAutocomplete from './PersonAutocomplete';
import { formatFullName } from '@/lib/nameUtils';
import { Button } from './ui/Button';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
}

interface RelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
}

interface Relationship {
  id: string;
  personId: string;
  relationshipTypeId: string | null;
  notes: string | null;
  person: Person;
  relationshipType: RelationshipType | null;
}

interface RelationshipManagerProps {
  personId: string;
  personName: string;
  relationships: Relationship[];
  availablePeople: Person[];
  relationshipTypes: RelationshipType[];
  currentUser?: {
    id: string;
    name: string;
    surname?: string | null;
    nickname?: string | null;
  };
  hasUserRelationship?: boolean;
}

export default function RelationshipManager({
  personId,
  personName: _personName,
  relationships,
  availablePeople,
  relationshipTypes,
  currentUser,
  hasUserRelationship = false,
}: RelationshipManagerProps) {
  const t = useTranslations('people');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] =
    useState<Relationship | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Include user in available people if no relationship exists
  const peopleWithUser = currentUser && !hasUserRelationship
    ? [currentUser, ...availablePeople]
    : availablePeople;

  // Find default FRIEND type or use first available
  const defaultTypeId = relationshipTypes.find((t) => t.name === 'FRIEND')?.id || relationshipTypes[0]?.id || '';

  const [formData, setFormData] = useState({
    relatedPersonId: '',
    relationshipTypeId: defaultTypeId,
    notes: '',
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Special case: If the related person is the current user
      if (currentUser && formData.relatedPersonId === currentUser.id) {
        // Find the selected relationship type's inverse
        const selectedType = relationshipTypes.find(rt => rt.id === formData.relationshipTypeId);

        if (!selectedType || !selectedType.inverseId) {
          setError('Cannot create this relationship: no inverse relationship type defined');
          setIsLoading(false);
          return;
        }

        // Update the person's relationshipToUserId with the inverse
        const response = await fetch(`/api/people/${personId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relationshipToUserId: selectedType.inverseId,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to create relationship');
          setIsLoading(false);
          return;
        }

        toast.success(`Relationship with you has been added`);
        setShowAddModal(false);
        setFormData({ relatedPersonId: '', relationshipTypeId: defaultTypeId, notes: '' });
        router.refresh();
        return;
      }

      // Regular person-to-person relationship
      // Since we display relationshipsTo (relationships pointing TO the current person),
      // we create the relationship FROM the other person TO the current person
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: formData.relatedPersonId,  // The other person (source)
          relatedPersonId: personId,           // The current person (target)
          relationshipTypeId: formData.relationshipTypeId,  // Use the type the user selected
          notes: formData.notes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create relationship');
        setIsLoading(false);
        return;
      }

      const relatedPerson = peopleWithUser.find(p => p.id === formData.relatedPersonId);
      toast.success(`Relationship with ${formatFullName(relatedPerson!)} has been added`);

      setShowAddModal(false);
      setFormData({ relatedPersonId: '', relationshipTypeId: defaultTypeId, notes: '' });
      router.refresh();
    } catch (_error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelationship) return;

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/relationships/${selectedRelationship.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relationshipTypeId: formData.relationshipTypeId,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update relationship');
        setIsLoading(false);
        return;
      }

      toast.success(`Relationship with ${formatFullName(selectedRelationship.person)} has been updated`);

      setShowEditModal(false);
      setSelectedRelationship(null);
      router.refresh();
    } catch (_error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRelationship) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/relationships/${selectedRelationship.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to delete relationship. Please try again.');
        setIsLoading(false);
        return;
      }

      setShowDeleteModal(false);
      setSelectedRelationship(null);
      router.refresh();
    } catch (_error) {
      setError('Unable to connect to server. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  const openEditModal = (relationship: Relationship) => {
    setSelectedRelationship(relationship);
    setFormData({
      relatedPersonId: relationship.personId,
      relationshipTypeId: relationship.relationshipTypeId || defaultTypeId,
      notes: relationship.notes || '',
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (relationship: Relationship) => {
    setSelectedRelationship(relationship);
    setShowDeleteModal(true);
  };

  const handleCreateNewPerson = (searchTerm: string) => {
    // Navigate to create person page with pre-filled data
    const params = new URLSearchParams({
      name: searchTerm,
      knownThrough: personId,
      relationshipType: formData.relationshipTypeId,
    });
    router.push(`/people/new?${params.toString()}`);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-base font-medium text-muted">
          {t('otherRelationships')}
        </h4>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50"
        >
          {t('addRelationship')}
        </button>
      </div>

      {relationships.length === 0 ? (
        <p className="text-muted text-sm">
          {t('noRelationshipsYet')}
        </p>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/people/${rel.personId}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    {formatFullName(rel.person)}
                  </Link>
                  <span className="text-muted">•</span>
                  <span
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: rel.relationshipType?.color
                        ? `${rel.relationshipType.color}20`
                        : '#E5E7EB',
                      color: rel.relationshipType?.color || '#374151',
                    }}
                  >
                    {rel.relationshipType?.label || 'Unknown'}
                  </span>
                </div>
                {rel.notes && (
                  <p className="text-sm text-muted mt-1">
                    {rel.notes}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => openEditModal(rel)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  title={t('edit')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => openDeleteModal(rel)}
                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                  title={t('delete')}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('addRelationship')}
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && (
                <div className="bg-warning/10 border-2 border-warning text-warning px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('relationshipType')} *
                </label>
                <select
                  required
                  value={formData.relationshipTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, relationshipTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('person')} *
                </label>
                <PersonAutocomplete
                  people={peopleWithUser}
                  value={formData.relatedPersonId}
                  onChange={(personId) =>
                    setFormData({ ...formData, relatedPersonId: personId })
                  }
                  placeholder={t('searchForPerson')}
                  required
                  onCreateNew={handleCreateNewPerson}
                  highlightPersonId={currentUser?.id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('notes')}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('optionalNotes')}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? t('adding') : t('addRelationship')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('editRelationship', { name: formatFullName(selectedRelationship.person) })}
            </h3>
            <form onSubmit={handleEdit} className="space-y-4">
              {error && (
                <div className="bg-warning/10 border-2 border-warning text-warning px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('relationshipType')} *
                </label>
                <select
                  required
                  value={formData.relationshipTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, relationshipTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  {t('notes')}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('optionalNotes')}
                />
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
      {showDeleteModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('deleteRelationship')}
            </h3>
            <p className="text-muted mb-6">
              {t('deleteRelationshipConfirm', { name: formatFullName(selectedRelationship.person) })}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-warning/10 border-2 border-warning text-warning rounded text-sm">
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
    </div>
  );
}
