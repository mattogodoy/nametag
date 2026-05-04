'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import PillSelector from './PillSelector';
import { formatFullName } from '@/lib/nameUtils';
import { getRandomColor, PRESET_COLORS } from '@/lib/colors';
import { Button } from './ui/Button';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
}

interface GroupFormProps {
  group?: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  mode: 'create' | 'edit';
  availablePeople?: Person[]; // Only used in create mode
  nameOrder?: 'WESTERN' | 'EASTERN';
}

export default function GroupForm({
  group,
  mode,
  availablePeople = [],
  nameOrder,
}: GroupFormProps) {
  const t = useTranslations('groups.form');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    color: group?.color || getRandomColor(),
  });

  // State for selected people (only used in create mode)
  const [selectedPeople, setSelectedPeople] = useState<{ id: string; label: string }[]>([]);

  const handleRerollColor = () => {
    setFormData((prev) => ({
      ...prev,
      color: getRandomColor(),
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const url = mode === 'create' ? '/api/groups' : `/api/groups/${group?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // Include peopleIds when creating a group
      const payload = mode === 'create'
        ? { ...formData, peopleIds: selectedPeople.map(p => p.id) }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('errorSomethingWrong'));
        return;
      }

      // Show success toast
      toast.success(
        mode === 'create'
          ? t('successCreated', { name: formData.name })
          : t('successUpdated', { name: formData.name })
      );

      // Redirect to detail page after edit, list page after create
      if (mode === 'edit' && group?.id) {
        router.push(`/groups/${group.id}`);
      } else {
        router.push('/groups');
      }
      router.refresh();
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded" role="alert">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('groupNameRequired')}
        </label>
        <input
          type="text"
          id="name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('groupNamePlaceholder')}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('description')}
        </label>
        <textarea
          id="description"
          rows={3}
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={t('descriptionPlaceholder')}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          {t('color')}
        </label>
        <div className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setFormData({ ...formData, color })}
              className={`w-10 h-10 rounded-full transition-shadow ${
                formData.color === color
                  ? 'ring-4 ring-primary ring-offset-2 dark:ring-offset-gray-800'
                  : 'hover:ring-2 hover:ring-border'
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
            {t('customColor')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="customColor"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-20 h-10 rounded cursor-pointer"
            />
            <button
              type="button"
              onClick={handleRerollColor}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-elevated hover:text-foreground"
              aria-label={t('generateRandomColor')}
              title={t('generateRandomColor')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <rect width="12" height="12" x="2" y="10" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18h.01" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 14h.01" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 6h.01" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9h.01" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* People selector - only shown when creating a new group */}
      {mode === 'create' && availablePeople.length > 0 && (
        <div>
          <PillSelector
            label={t('addPeople')}
            selectedItems={selectedPeople}
            availableItems={availablePeople.map(person => ({
              id: person.id,
              label: formatFullName(person, nameOrder),
            }))}
            onAdd={(item) => setSelectedPeople([...selectedPeople, item])}
            onRemove={(itemId) => setSelectedPeople(selectedPeople.filter(p => p.id !== itemId))}
            placeholder={t('addPeoplePlaceholder')}
            emptyMessage={t('noPeopleFound')}
            helpText={t('addPeopleHelp')}
            isLoading={isLoading}
          />
        </div>
      )}

      <div className="flex justify-end space-x-4 pt-4">
        <Button variant="secondary" href="/groups">
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading
            ? t('saving')
            : mode === 'create'
            ? t('createGroup')
            : t('updateGroup')}
        </Button>
      </div>
    </form>
  );
}
