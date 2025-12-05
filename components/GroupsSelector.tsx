'use client';

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
}

export default function GroupsSelector({
  availableGroups,
  selectedGroupIds,
  onChange,
}: GroupsSelectorProps) {
  // Transform groups to PillItem format
  const pillItems = availableGroups.map((group) => ({
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
      placeholder="Type to search groups..."
      emptyMessage="No groups found matching"
      helpText="Type to search for groups and press Enter to add them. Click × to remove."
      showAllOnFocus={true}
      renderPill={renderGroupPill}
    />
  );
}
