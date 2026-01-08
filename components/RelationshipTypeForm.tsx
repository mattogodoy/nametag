'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import RelationshipTypeAutocomplete from './RelationshipTypeAutocomplete';
import { Button } from './ui/Button';

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

  // Symmetric relationship toggle (inverse is the same as main, e.g., friend <-> friend)
  const isInitiallySymmetric = relationshipType?.inverseId === relationshipType?.id;
  const [isSymmetric, setIsSymmetric] = useState(isInitiallySymmetric);

  // Sanitize label to create internal name
  const sanitizeName = (label: string): string => {
    return label
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
  };

  type RelationshipTypePayload = {
    label: string;
    color: string | null;
    name: string;
    symmetric?: true;
    inverseId?: string | null;
    inverseLabel?: string;
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
      const payload: RelationshipTypePayload = {
        ...formData,
        name,
      };

      // Add inverse relationship data
      if (isSymmetric) {
        // Symmetric relationship - inverse is the same as main (e.g., friend <-> friend)
        payload.symmetric = true;
      } else if (inverseValue) {
        if (inverseIsExisting) {
          // Existing type - send ID
          payload.inverseId = inverseValue;
        } else {
          // New type - send label to create
          payload.inverseLabel = inverseLabel || inverseValue;
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

      // Show success toast
      toast.success(
        mode === 'create'
          ? `Relationship type "${formData.label}" has been created`
          : `Relationship type "${formData.label}" has been updated`
      );

      router.push('/relationship-types');
      router.refresh();
    } catch {
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
          className="block text-sm font-medium text-muted mb-1"
        >
          Relationship Label *
        </label>
        <input
          type="text"
          id="label"
          required
          value={formData.label}
          onChange={(e) => setFormData({ ...formData, label: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Mentor, Student, Neighbor"
        />
        <p className="text-xs text-muted mt-1">
          The name that will be displayed to users
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          Inverse Relationship
        </label>

        {/* Symmetric toggle */}
        <div className="flex items-center mb-3">
          <button
            type="button"
            role="switch"
            aria-checked={isSymmetric}
            onClick={() => {
              setIsSymmetric(!isSymmetric);
              if (!isSymmetric) {
                // When enabling symmetric, clear the inverse value
                setInverseValue('');
                setInverseIsExisting(false);
                setInverseLabel('');
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
              isSymmetric ? 'bg-blue-600' : 'bg-surface-elevated'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isSymmetric ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="ml-3 text-sm text-muted">
            Symmetric (same as inverse)
          </span>
        </div>
        <p className="text-xs text-muted mb-3">
          {isSymmetric
            ? `Both directions will use the same label (e.g., Friend ↔ Friend)`
            : 'The reciprocal relationship (e.g., Parent ↔ Child, Mentor ↔ Student)'}
        </p>

        {/* Inverse autocomplete - only shown when not symmetric */}
        {!isSymmetric && (
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
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
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
            className="block text-xs text-muted mb-1"
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
        <Button variant="secondary" href="/relationship-types">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? 'Saving...'
            : mode === 'create'
            ? 'Create Type'
            : 'Update Type'}
        </Button>
      </div>
    </form>
  );
}
