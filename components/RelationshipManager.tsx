'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PersonAutocomplete from './PersonAutocomplete';

interface Person {
  id: string;
  fullName: string;
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
  relationships: Relationship[];
  availablePeople: Person[];
  relationshipTypes: RelationshipType[];
}

export default function RelationshipManager({
  personId,
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

      setShowAddModal(false);
      setFormData({ relatedPersonId: '', relationshipTypeId: defaultTypeId, notes: '' });
      router.refresh();
    } catch (error) {
      setError('Failed to create relationship');
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

      setShowEditModal(false);
      setSelectedRelationship(null);
      router.refresh();
    } catch (error) {
      setError('Failed to update relationship');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRelationship) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/relationships/${selectedRelationship.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        alert('Failed to delete relationship');
        setIsLoading(false);
        return;
      }

      setShowDeleteModal(false);
      setSelectedRelationship(null);
      router.refresh();
    } catch (error) {
      alert('Failed to delete relationship');
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

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Relationships
        </h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Add Relationship
        </button>
      </div>

      {relationships.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No relationships yet.
        </p>
      ) : (
        <div className="space-y-2">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex-1">
                <Link
                  href={`/people/${rel.relatedPersonId}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {rel.relatedPerson.fullName}
                </Link>
                <span className="text-gray-500 dark:text-gray-400 ml-2">
                  ({rel.relationshipType?.label || 'Unknown'})
                </span>
                {rel.notes && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {rel.notes}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => openEditModal(rel)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => openDeleteModal(rel)}
                  className="text-red-600 dark:text-red-400 hover:underline text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Relationship
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Person *
                </label>
                <PersonAutocomplete
                  people={availablePeople}
                  value={formData.relatedPersonId}
                  onChange={(personId) =>
                    setFormData({ ...formData, relatedPersonId: personId })
                  }
                  placeholder="Search for a person..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Relationship Type *
                </label>
                <select
                  required
                  value={formData.relationshipTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, relationshipTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Relationship'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Edit Relationship with {selectedRelationship.relatedPerson.fullName}
            </h3>
            <form onSubmit={handleEdit} className="space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Relationship Type *
                </label>
                <select
                  required
                  value={formData.relationshipTypeId}
                  onChange={(e) =>
                    setFormData({ ...formData, relationshipTypeId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {relationshipTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedRelationship && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Relationship
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete the relationship with{' '}
              <strong className="text-gray-900 dark:text-white">
                {selectedRelationship.relatedPerson.fullName}
              </strong>
              ? This will also remove the reverse relationship.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
