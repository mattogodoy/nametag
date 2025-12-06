'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import PersonAutocomplete from './PersonAutocomplete';
import { formatFullName } from '@/lib/nameUtils';

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
}

interface Relationship {
  id: string;
  relatedPersonId: string;
  relationshipTypeId: string | null;
  notes: string | null;
  relatedPerson: Person;
  relationshipType: RelationshipType | null;
}

interface RelationshipManagerProps {
  personId: string;
  personName: string;
  relationships: Relationship[];
  availablePeople: Person[];
  relationshipTypes: RelationshipType[];
}

export default function RelationshipManager({
  personId,
  personName,
  relationships,
  availablePeople,
  relationshipTypes,
}: RelationshipManagerProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRelationship, setSelectedRelationship] =
    useState<Relationship | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId,
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create relationship');
        setIsLoading(false);
        return;
      }

      const relatedPerson = availablePeople.find(p => p.id === formData.relatedPersonId);
      toast.success(`Relationship with ${formatFullName(relatedPerson!)} has been added`);

      setShowAddModal(false);
      setFormData({ relatedPersonId: '', relationshipTypeId: defaultTypeId, notes: '' });
      router.refresh();
    } catch (error) {
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

      toast.success(`Relationship with ${formatFullName(selectedRelationship.relatedPerson)} has been updated`);

      setShowEditModal(false);
      setSelectedRelationship(null);
      router.refresh();
    } catch (error) {
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
    } catch (error) {
      setError('Unable to connect to server. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  const openEditModal = (relationship: Relationship) => {
    setSelectedRelationship(relationship);
    setFormData({
      relatedPersonId: relationship.relatedPersonId,
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
        <h4 className="text-base font-medium text-base-content/80">
          Other Relationships
        </h4>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary btn-sm"
        >
          <span className="icon-[tabler--plus] size-4" />
          Add Relationship
        </button>
      </div>

      {relationships.length === 0 ? (
        <p className="text-base-content/60 text-sm">
          No relationships yet.
        </p>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between p-3 bg-base-300 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/people/${rel.relatedPersonId}`}
                    className="link link-primary font-medium"
                  >
                    {formatFullName(rel.relatedPerson)}
                  </Link>
                  <span className="text-base-content/40">•</span>
                  <span
                    className="badge badge-sm"
                    style={{
                      backgroundColor: rel.relationshipType?.color
                        ? `${rel.relationshipType.color}20`
                        : undefined,
                      color: rel.relationshipType?.color || undefined,
                    }}
                  >
                    {rel.relationshipType?.label || 'Unknown'}
                  </span>
                </div>
                {rel.notes && (
                  <p className="text-sm text-base-content/60 mt-1">
                    {rel.notes}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEditModal(rel)}
                  className="btn btn-ghost btn-square btn-sm"
                  title="Edit"
                >
                  <span className="icon-[tabler--edit] size-4" />
                </button>
                <button
                  onClick={() => openDeleteModal(rel)}
                  className="btn btn-ghost btn-square btn-sm text-error"
                  title="Delete"
                >
                  <span className="icon-[tabler--trash] size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 max-w-md w-full shadow-xl">
            <div className="card-body">
              <h3 className="card-title">
                Add Relationship
              </h3>
              <form onSubmit={handleAdd} className="space-y-4">
                {error && (
                  <div className="alert alert-error">
                    <span className="icon-[tabler--alert-circle] size-5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Relationship Type *</span>
                  </label>
                  <select
                    required
                    value={formData.relationshipTypeId}
                    onChange={(e) =>
                      setFormData({ ...formData, relationshipTypeId: e.target.value })
                    }
                    className="select"
                  >
                    {relationshipTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Person *</span>
                  </label>
                  <PersonAutocomplete
                    people={availablePeople}
                    value={formData.relatedPersonId}
                    onChange={(personId) =>
                      setFormData({ ...formData, relatedPersonId: personId })
                    }
                    placeholder="Search for a person..."
                    required
                    onCreateNew={handleCreateNewPerson}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Notes</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="textarea"
                    placeholder="Optional notes..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                  >
                    {isLoading && <span className="loading loading-spinner loading-sm" />}
                    {isLoading ? 'Adding...' : 'Add Relationship'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 max-w-md w-full shadow-xl">
            <div className="card-body">
              <h3 className="card-title">
                Edit Relationship with {formatFullName(selectedRelationship.relatedPerson)}
              </h3>
              <form onSubmit={handleEdit} className="space-y-4">
                {error && (
                  <div className="alert alert-error">
                    <span className="icon-[tabler--alert-circle] size-5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Relationship Type *</span>
                  </label>
                  <select
                    required
                    value={formData.relationshipTypeId}
                    onChange={(e) =>
                      setFormData({ ...formData, relationshipTypeId: e.target.value })
                    }
                    className="select"
                  >
                    {relationshipTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Notes</span>
                  </label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="textarea"
                    placeholder="Optional notes..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                  >
                    {isLoading && <span className="loading loading-spinner loading-sm" />}
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card bg-base-100 max-w-md w-full shadow-xl">
            <div className="card-body">
              <h3 className="card-title">
                Delete Relationship
              </h3>
              <p className="text-base-content/70">
                Are you sure you want to delete the relationship with{' '}
                <strong className="text-base-content">
                  {formatFullName(selectedRelationship.relatedPerson)}
                </strong>
                ? This will also remove the reverse relationship.
              </p>

              {error && (
                <div className="alert alert-error mt-4">
                  <span className="icon-[tabler--alert-circle] size-5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isLoading}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="btn btn-error"
                >
                  {isLoading && <span className="loading loading-spinner loading-sm" />}
                  {isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
