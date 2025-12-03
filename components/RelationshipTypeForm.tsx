'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import RelationshipTypeAutocomplete from './RelationshipTypeAutocomplete';

interface RelationshipType {
  id: string;
  name: string;
  label: string;
  color: string | null;
  inverseId: string | null;
  inverse?: {
    id: string;
    name: string;
    label: string;
  } | null;
}

interface RelationshipTypeFormProps {
  relationshipType?: RelationshipType;
  availableTypes: RelationshipType[];
  mode: 'create' | 'edit';
}

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#10B981', // Green
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

export default function RelationshipTypeForm({
  relationshipType,
  availableTypes,
  mode,
}: RelationshipTypeFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    label: relationshipType?.label || '',
    color: relationshipType?.color || PRESET_COLORS[0],
  });

  // Track inverse relationship
  const [inverseValue, setInverseValue] = useState(relationshipType?.inverseId || '');
  const [inverseIsExisting, setInverseIsExisting] = useState(!!relationshipType?.inverseId);
  const [inverseLabel, setInverseLabel] = useState(relationshipType?.inverse?.label || '');

  // Sanitize label to create internal name
  const sanitizeName = (label: string): string => {
    return label
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url =
        mode === 'create'
          ? '/api/relationship-types'
          : `/api/relationship-types/${relationshipType?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // Generate internal name from label
      const name = sanitizeName(formData.label);

      // Prepare payload
      const payload: any = {
        ...formData,
        name,
      };

      // Add inverse relationship data
      if (inverseValue) {
        if (inverseIsExisting) {
          // Existing type - send ID
          payload.inverseId = inverseValue;
        } else {
          // New type - send label to create
          payload.inverseLabel = inverseValue;
        }
      } else {
        payload.inverseId = null;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      router.push('/relationship-types');
      router.refresh();
    } catch (error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
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
          htmlFor="label"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Relationship Label *
        </label>
        <input
          type="text"
          id="label"
          required
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Mentor, Student, Neighbor"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          The name that will be displayed to users
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Inverse Relationship (Optional)
        </label>
        <RelationshipTypeAutocomplete
          types={availableTypes}
          value={inverseValue}
          isExisting={inverseIsExisting}
          onChange={(value, isExisting, label) => {
            setInverseValue(value);
            setInverseIsExisting(isExisting);
            setInverseLabel(label);
          }}
          placeholder="Search existing or type to create new..."
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select an existing type or type a new name to create it automatically. The reciprocal relationship (e.g., Parent ↔ Child, Mentor ↔ Student)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-10 h-10 rounded-full transition-all ${
                formData.color === color
                  ? 'ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="mt-3">
          <label
            htmlFor="customColor"
            className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Or choose a custom color:
          </label>
          <input
            type="color"
            id="customColor"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-20 h-10 rounded cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-4 pt-4">
        <Link
          href="/relationship-types"
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
            ? 'Create Type'
            : 'Update Type'}
        </button>
      </div>
    </form>
  );
}
