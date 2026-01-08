'use client';

import { useState, useRef, useEffect } from 'react';

interface RelationshipType {
  id: string;
  label: string;
  name: string;
}

interface RelationshipTypeAutocompleteProps {
  types: RelationshipType[];
  value: string; // Can be an ID (existing) or a label (new)
  isExisting: boolean; // Whether the value is an existing type ID
  onChange: (value: string, isExisting: boolean, label: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function RelationshipTypeAutocomplete({
  types,
  value,
  isExisting,
  onChange,
  placeholder = 'Search or create inverse relationship...',
  required = false,
}: RelationshipTypeAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the selected type's label or use the custom value
  const selectedType = types.find((t) => t.id === value);
  const displayValue = selectedType ? selectedType.label : isExisting ? '' : value || searchTerm;

  // Filter types based on search term
  const filteredTypes = types.filter((type) =>
    type.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If no selection was made, clear search term
        if (!value && searchTerm && filteredTypes.length === 0) {
          // Keep the custom value
        } else if (!value) {
          setSearchTerm('');
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, searchTerm, filteredTypes.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    setHighlightedIndex(0);

    // If typing, treat as new custom type
    onChange(newValue, false, newValue);
  };

  const handleSelect = (type: RelationshipType) => {
    onChange(type.id, true, type.label);
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredTypes.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredTypes[highlightedIndex]) {
          handleSelect(filteredTypes[highlightedIndex]);
        } else {
          // No match - keep the custom value and close
          setIsOpen(false);
          inputRef.current?.blur();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        if (!value) {
          setSearchTerm('');
        }
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleClear = () => {
    onChange('', false, '');
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && filteredTypes.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredTypes.map((type, index) => (
            <button
              key={type.id}
              type="button"
              onClick={() => handleSelect(type)}
              className={`w-full text-left px-3 py-2 hover:bg-surface-elevated transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : ''
              } ${
                type.id === value
                  ? 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                  : ''
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="text-foreground">
                {type.label}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm && filteredTypes.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm text-green-600 dark:text-green-400">
            Press Enter to create new type: &quot;{searchTerm}&quot;
          </p>
        </div>
      )}

      {!isExisting && value && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          ✓ Will create new type: &quot;{value}&quot;
        </p>
      )}
    </div>
  );
}
