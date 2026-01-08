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
  onCreateNew?: (name: string) => void | Promise<void>;
  placeholder?: string;
  emptyMessage?: string;
  createNewLabel?: string;
  helpText?: string;
  renderPill?: (item: T, onRemove: () => void) => ReactNode;
  renderSuggestion?: (item: T) => ReactNode;
  showAllOnFocus?: boolean;
  isLoading?: boolean;
  onClearAll?: () => void;
}

export default function PillSelector<T extends PillItem>({
  label,
  selectedItems,
  availableItems,
  onAdd,
  onRemove,
  onCreateNew,
  placeholder = 'Type to search...',
  emptyMessage = 'No items found',
  createNewLabel = 'Create',
  helpText,
  renderPill,
  renderSuggestion,
  showAllOnFocus = false,
  isLoading = false,
  onClearAll,
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

  // Check if the search term exactly matches an existing item (case-insensitive)
  const exactMatch = availableItems.some(
    (item) => item.label.toLowerCase() === searchTerm.toLowerCase()
  );

  // Show create option if there's a search term, no exact match, and onCreateNew is provided
  const showCreateOption = searchTerm && !exactMatch && onCreateNew;

  // Total options including create option for keyboard navigation
  const totalOptions = filteredSuggestions.length + (showCreateOption ? 1 : 0);
  const createOptionIndex = filteredSuggestions.length;

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
  };

  const handleCreateNew = async () => {
    if (onCreateNew && searchTerm) {
      await onCreateNew(searchTerm);
      setSearchTerm('');
      setShowSuggestions(showAllOnFocus);
      setHighlightedIndex(0);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < totalOptions - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex === createOptionIndex && showCreateOption) {
        handleCreateNew();
      } else if (filteredSuggestions.length > 0 && filteredSuggestions[highlightedIndex]) {
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
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
        onClick={() => {
          onRemoveClick();
        }}
        disabled={isLoading}
        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors disabled:opacity-50"
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

  // Default suggestion renderer
  const defaultRenderSuggestion = (item: T) => (
    <>
      {item.color && (
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: item.color }}
        />
      )}
      <span className="text-foreground">{item.label}</span>
    </>
  );

  const pillRenderer = renderPill || defaultRenderPill;
  const suggestionRenderer = renderSuggestion || defaultRenderSuggestion;

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
      )}

      {/* Input box with pills */}
      <div
        className="min-h-[42px] p-2 border-2 border-border rounded-lg bg-surface-elevated focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20 transition-all cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-1.5 items-center">
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
              className="w-full px-2 py-1 bg-transparent text-foreground placeholder-muted focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Clear all button */}
          {onClearAll && selectedItems.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              onMouseDown={(e) => e.preventDefault()}
              disabled={isLoading}
              className="flex-shrink-0 p-1 text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
              aria-label="Clear all"
              title="Clear all"
            >
              <svg
                className="w-5 h-5"
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
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (searchTerm || showAllOnFocus) && (
        <div className="absolute left-0 right-0 mt-1 bg-surface border-2 border-secondary/30 rounded-lg shadow-lg shadow-secondary/20 max-h-60 overflow-y-auto z-50">
          {filteredSuggestions.length > 0 || showCreateOption ? (
            <ul>
              {filteredSuggestions.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleAdd(item)}
                    className={`w-full text-left px-4 py-2 hover:bg-surface-elevated transition-colors flex items-center gap-2 border-l-2 ${
                      index === highlightedIndex
                        ? 'bg-secondary/10 border-l-secondary'
                        : 'border-l-transparent'
                    }`}
                  >
                    {suggestionRenderer(item)}
                  </button>
                </li>
              ))}
              {showCreateOption && (
                <li>
                  {filteredSuggestions.length > 0 && (
                    <div className="border-t border-border" />
                  )}
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2 ${
                      highlightedIndex === createOptionIndex
                        ? 'bg-primary/20'
                        : 'bg-primary/10 hover:bg-primary/20'
                    }`}
                  >
                    <div className="flex items-center justify-center w-5 h-5 bg-primary rounded-full flex-shrink-0">
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <span className="font-medium text-primary">
                        {createNewLabel} &quot;{searchTerm}&quot;
                      </span>
                    </div>
                  </button>
                </li>
              )}
            </ul>
          ) : searchTerm ? (
            <div className="px-4 py-3 text-sm text-muted">
              {emptyMessage} &quot;{searchTerm}&quot;
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted">
              All items are already selected
            </div>
          )}
        </div>
      )}

      {helpText && (
        <p className="mt-1 text-xs text-muted">
          {helpText}
        </p>
      )}
    </div>
  );
}
