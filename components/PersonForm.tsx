'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PersonFormProps {
  person?: {
    id: string;
    fullName: string;
    birthDate: Date | null;
    phone: string | null;
    address: string | null;
    lastContact: Date | null;
    notes: string | null;
    relationshipToUserId: string;
    groups: Array<{ groupId: string }>;
  };
  groups: Array<{
    id: string;
    name: string;
    color: string | null;
  }>;
  relationshipTypes: Array<{
    id: string;
    label: string;
    color: string | null;
  }>;
  mode: 'create' | 'edit';
}

export default function PersonForm({ person, groups, relationshipTypes, mode }: PersonFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: person?.fullName || '',
    birthDate: person?.birthDate
      ? new Date(person.birthDate).toISOString().split('T')[0]
      : '',
    phone: person?.phone || '',
    address: person?.address || '',
    lastContact: person?.lastContact
      ? new Date(person.lastContact).toISOString().split('T')[0]
      : '',
    notes: person?.notes || '',
    relationshipToUserId: person?.relationshipToUserId || '',
    groupIds: person?.groups.map((g) => g.groupId) || [],
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/people' : `/api/people/${person?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      // Redirect to detail page after edit, list page after create
      if (mode === 'edit' && person?.id) {
        router.push(`/people/${person.id}`);
      } else {
        router.push('/people');
      }
      router.refresh();
    } catch (error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupToggle = (groupId: string) => {
    setFormData((prev) => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter((id) => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  const setLastContactToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...formData, lastContact: today });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Full Name *
        </label>
        <input
          type="text"
          id="fullName"
          required
          value={formData.fullName}
          onChange={(e) =>
            setFormData({ ...formData, fullName: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="relationshipToUserId"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Relationship to You *
        </label>
        <select
          id="relationshipToUserId"
          required
          value={formData.relationshipToUserId}
          onChange={(e) =>
            setFormData({ ...formData, relationshipToUserId: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a relationship...</option>
          {relationshipTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label
            htmlFor="birthDate"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Birth Date
          </label>
          <input
            type="date"
            id="birthDate"
            value={formData.birthDate}
            onChange={(e) =>
              setFormData({ ...formData, birthDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Phone
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Address
        </label>
        <input
          type="text"
          id="address"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="lastContact"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Last Contact
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            id="lastContact"
            value={formData.lastContact}
            onChange={(e) =>
              setFormData({ ...formData, lastContact: e.target.value })
            }
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={setLastContactToToday}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {groups.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Groups
          </label>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => handleGroupToggle(group.id)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.groupIds.includes(group.id)
                    ? 'ring-2 ring-blue-500'
                    : 'ring-1 ring-gray-300 dark:ring-gray-600'
                }`}
                style={{
                  backgroundColor: group.color
                    ? formData.groupIds.includes(group.id)
                      ? group.color
                      : `${group.color}40`
                    : formData.groupIds.includes(group.id)
                    ? '#3B82F6'
                    : '#E5E7EB',
                  color: formData.groupIds.includes(group.id) ? 'white' : '#374151',
                }}
              >
                {group.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <Link
          href="/people"
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? 'Saving...'
            : mode === 'create'
            ? 'Create Person'
            : 'Update Person'}
        </button>
      </div>
    </form>
  );
}
