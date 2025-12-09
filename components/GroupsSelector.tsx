'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import PillSelector from './PillSelector';

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface GroupsSelectorProps {
  availableGroups: Group[];
  selectedGroupIds: string[];
  onChange: (groupIds: string[]) => void;
  allowCreate?: boolean;
}

// Generate a random color from a nice palette
function generateRandomColor(): string {
  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function GroupsSelector({
  availableGroups,
  selectedGroupIds,
  onChange,
  allowCreate = true,
}: GroupsSelectorProps) {
  // Track newly created groups that aren't in the original list
  const [createdGroups, setCreatedGroups] = useState<Group[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Combine original groups with newly created ones
  const allGroups = [...availableGroups, ...createdGroups.filter(
    (cg) => !availableGroups.some((ag) => ag.id === cg.id)
  )];

  // Transform groups to PillItem format
  const pillItems = allGroups.map((group) => ({
    id: group.id,
    label: group.name,
    color: group.color,
  }));

  const selectedItems = pillItems.filter((item) =>
    selectedGroupIds.includes(item.id)
  );

  const handleAdd = (item: { id: string }) => {
    onChange([...selectedGroupIds, item.id]);
  };

  const handleRemove = (itemId: string) => {
    onChange(selectedGroupIds.filter((id) => id !== itemId));
  };

  const handleCreateNew = async (name: string) => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          color: generateRandomColor(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to create group');
        return;
      }

      const newGroup: Group = {
        id: data.group.id,
        name: data.group.name,
        color: data.group.color,
      };

      // Add to created groups list
      setCreatedGroups((prev) => [...prev, newGroup]);

      // Auto-select the newly created group
      onChange([...selectedGroupIds, newGroup.id]);

      toast.success(`Group "${name}" created`);
    } catch (error) {
      toast.error('Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  // Custom pill renderer for groups (gray background with color circle on left)
  const renderGroupPill = (
    item: { id: string; label: string; color?: string | null },
    onRemove: () => void
  ) => (
    <div key={item.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{
          backgroundColor: item.color || '#9CA3AF',
        }}
      />
      <span className="text-gray-900 dark:text-white">{item.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-0.5 transition-colors text-gray-600 dark:text-gray-400"
        aria-label={`Remove ${item.label}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );

  return (
    <PillSelector
      selectedItems={selectedItems}
      availableItems={pillItems}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onCreateNew={allowCreate ? handleCreateNew : undefined}
      placeholder="Type to search groups..."
      emptyMessage="No groups found matching"
      createNewLabel="Create group"
      helpText={allowCreate
        ? "Type to search or create new groups. Press Enter to add."
        : "Type to search for groups and press Enter to add them. Click × to remove."
      }
      showAllOnFocus={true}
      renderPill={renderGroupPill}
      isLoading={isCreating}
    />
  );
}
