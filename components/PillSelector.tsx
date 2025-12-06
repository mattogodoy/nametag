'use client';

import { useState, useRef, KeyboardEvent, ReactNode } from 'react';

interface PillItem {
  id: string;
  label: string;
  color?: string | null;
}

interface PillSelectorProps<T extends PillItem> {
  label?: string;
  selectedItems: T[];
  availableItems: T[];
  onAdd: (item: T) => void;
  onRemove: (itemId: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  helpText?: string;
  renderPill?: (item: T, onRemove: () => void) => ReactNode;
  renderSuggestion?: (item: T) => ReactNode;
  showAllOnFocus?: boolean;
  isLoading?: boolean;
}

export default function PillSelector<T extends PillItem>({
  label,
  selectedItems,
  availableItems,
  onAdd,
  onRemove,
  placeholder = 'Type to search...',
  emptyMessage = 'No items found',
  helpText,
  renderPill,
  renderSuggestion,
  showAllOnFocus = false,
  isLoading = false,
}: PillSelectorProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Get selected item IDs for quick lookup
  const selectedIds = new Set(selectedItems.map((item) => item.id));

  // Filter available items to exclude already selected ones
  const unselectedItems = availableItems.filter(
    (item) => !selectedIds.has(item.id)
  );

  // Filter suggestions based on search term
  const filteredSuggestions = searchTerm
    ? unselectedItems.filter((item) =>
        item.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : showAllOnFocus
    ? unselectedItems
    : [];

  // Sort selected items alphabetically by label
  const sortedSelectedItems = [...selectedItems].sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  const handleAdd = (item: T) => {
    onAdd(item);
    setSearchTerm('');
    setShowSuggestions(showAllOnFocus);
    setHighlightedIndex(0);
    inputRef.current?.focus();
  };

  const handleRemove = (itemId: string) => {
    onRemove(itemId);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSuggestions.length > 0 && filteredSuggestions[highlightedIndex]) {
        handleAdd(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSearchTerm('');
    } else if (e.key === 'Backspace' && !searchTerm && sortedSelectedItems.length > 0) {
      // Remove last item (alphabetically) when backspace is pressed on empty input
      handleRemove(sortedSelectedItems[sortedSelectedItems.length - 1].id);
    }
  };

  // Default pill renderer
  const defaultRenderPill = (item: T, onRemoveClick: () => void) => (
    <div
      key={item.id}
      className="badge badge-lg gap-2"
    >
      {item.color && (
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}
      <span>{item.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemoveClick();
        }}
        disabled={isLoading}
        className="hover:bg-base-content/20 rounded-full p-0.5 transition-colors disabled:opacity-50"
        aria-label={`Remove ${item.label}`}
      >
        <span className="icon-[tabler--x] size-4" />
      </button>
    </div>
  );

  // Default suggestion renderer
  const defaultRenderSuggestion = (item: T) => (
    <>
      {item.color && (
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}
      <span>{item.label}</span>
    </>
  );

  const pillRenderer = renderPill || defaultRenderPill;
  const suggestionRenderer = renderSuggestion || defaultRenderSuggestion;

  return (
    <div className="relative">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}

      {/* Input box with pills */}
      <div
        className="min-h-[60px] p-2 border-2 border-base-content/20 rounded-lg bg-base-100 focus-within:border-primary transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {/* Selected items as pills */}
          {sortedSelectedItems.map((item) =>
            pillRenderer(item, () => handleRemove(item.id))
          )}

          {/* Input field */}
          <div className="flex-1 min-w-[150px]">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
                setHighlightedIndex(0);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // Delay to allow clicking on suggestions
                setTimeout(() => setShowSuggestions(false), 200);
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedItems.length === 0
                  ? placeholder
                  : placeholder.replace('Type to search', 'Add more')
              }
              disabled={isLoading}
              className="w-full px-2 py-1 bg-transparent text-base-content placeholder-base-content/40 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (searchTerm || showAllOnFocus) && (
        <ul className="menu absolute left-0 right-0 mt-1 bg-base-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50 p-1">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleAdd(item)}
                  className={`flex items-center gap-2 ${
                    index === highlightedIndex ? 'active' : ''
                  }`}
                >
                  {suggestionRenderer(item)}
                </button>
              </li>
            ))
          ) : searchTerm ? (
            <li className="px-4 py-3 text-sm text-base-content/60">
              {emptyMessage} &quot;{searchTerm}&quot;
            </li>
          ) : (
            <li className="px-4 py-3 text-sm text-base-content/60">
              All items are already selected
            </li>
          )}
        </ul>
      )}

      {helpText && (
        <label className="label">
          <span className="label-text-alt">{helpText}</span>
        </label>
      )}
    </div>
  );
}
