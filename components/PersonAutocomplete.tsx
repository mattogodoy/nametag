'use client';

import { useState, useRef, useEffect } from 'react';
import { formatFullName } from '@/lib/nameUtils';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
}

interface PersonAutocompleteProps {
  people: Person[];
  value: string;
  onChange: (personId: string, personName: string) => void;
  placeholder?: string;
  required?: boolean;
  onCreateNew?: (searchTerm: string) => void;
  highlightPersonId?: string;
}

export default function PersonAutocomplete({
  people,
  value,
  onChange,
  placeholder = 'Search for a person...',
  required = false,
  onCreateNew,
  highlightPersonId,
}: PersonAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the selected person's name
  const selectedPerson = people.find((p) => p.id === value);
  const displayValue = selectedPerson ? formatFullName(selectedPerson) : searchTerm;

  // Filter people based on search term - search in name, surname, and nickname
  const filteredPeople = people.filter((person) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      person.name.toLowerCase().includes(searchLower) ||
      person.surname?.toLowerCase().includes(searchLower) ||
      person.nickname?.toLowerCase().includes(searchLower)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!value) {
          setSearchTerm('');
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedIndex(0);
  }, [searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);

    // Clear selection if user is typing
    if (value) {
      onChange('', '');
    }
  };

  const handleSelect = (person: Person) => {
    onChange(person.id, formatFullName(person));
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Calculate total options including "Create new" option
  const hasCreateOption = onCreateNew && searchTerm;
  const totalOptions = filteredPeople.length + (hasCreateOption ? 1 : 0);
  const createNewIndex = filteredPeople.length; // "Create new" is always last

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < totalOptions - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex === createNewIndex && hasCreateOption) {
          // "Create new" option selected
          onCreateNew(searchTerm);
        } else if (filteredPeople.length > 0 && filteredPeople[highlightedIndex]) {
          handleSelect(filteredPeople[highlightedIndex]);
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
  };

  return (
    <div ref={wrapperRef} className="relative">
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

      {isOpen && (filteredPeople.length > 0 || hasCreateOption) && (
        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredPeople.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelect(person)}
              className={`w-full text-left px-3 py-2 hover:bg-surface-elevated transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : ''
              } ${
                person.id === value
                  ? 'bg-blue-100 dark:bg-blue-900/30 font-medium'
                  : ''
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="text-foreground">
                <span className={person.id === highlightPersonId ? 'font-bold' : ''}>
                  {formatFullName(person)}
                </span>
                {person.id === highlightPersonId && (
                  <span className="font-normal"> (you)</span>
                )}
              </div>
            </button>
          ))}
          {hasCreateOption && (
            <>
              {filteredPeople.length > 0 && (
                <div className="border-t border-border" />
              )}
              <button
                type="button"
                onClick={() => onCreateNew(searchTerm)}
                className={`w-full text-left px-3 py-2 hover:bg-surface-elevated transition-colors ${
                  highlightedIndex === createNewIndex
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''
                }`}
                onMouseEnter={() => setHighlightedIndex(createNewIndex)}
              >
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create &quot;{searchTerm}&quot;</span>
                </div>
              </button>
            </>
          )}
        </div>
      )}

      {isOpen && searchTerm && filteredPeople.length === 0 && !onCreateNew && (
        <div className="absolute z-10 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted">
            No people found matching &quot;{searchTerm}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
