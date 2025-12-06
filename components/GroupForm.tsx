'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

interface GroupFormProps {
  group?: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
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

export default function GroupForm({ group, mode }: GroupFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    color: group?.color || PRESET_COLORS[0],
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/groups' : `/api/groups/${group?.id}`;
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

      // Show success toast
      toast.success(
        mode === 'create'
          ? `Group "${formData.name}" has been created`
          : `Group "${formData.name}" has been updated`
      );

      // Redirect to detail page after edit, list page after create
      if (mode === 'edit' && group?.id) {
        router.push(`/groups/${group.id}`);
      } else {
        router.push('/groups');
      }
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
        <div className="alert alert-error">
          <span className="icon-[tabler--alert-circle] size-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="form-control">
        <label htmlFor="name" className="label">
          <span className="label-text">Group Name *</span>
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input"
          placeholder="e.g., Family, Friends, Colleagues"
        />
      </div>

      <div className="form-control">
        <label htmlFor="description" className="label">
          <span className="label-text">Description</span>
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="textarea"
          placeholder="Optional description for this group"
        />
      </div>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Color</span>
        </label>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-10 h-10 rounded-full transition-all ${
                formData.color === color
                  ? 'ring-4 ring-primary ring-offset-2 ring-offset-base-100 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div className="mt-3">
          <label htmlFor="customColor" className="label">
            <span className="label-text-alt">Or choose a custom color:</span>
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

      <div className="flex justify-end gap-3 pt-4">
        <Link href="/groups" className="btn btn-outline">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
        >
          {isLoading && <span className="loading loading-spinner loading-sm" />}
          {isLoading
            ? 'Saving...'
            : mode === 'create'
            ? 'Create Group'
            : 'Update Group'}
        </button>
      </div>
    </form>
  );
}
