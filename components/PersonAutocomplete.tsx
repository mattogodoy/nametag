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
}

export default function PersonAutocomplete({
  people,
  value,
  onChange,
  placeholder = 'Search for a person...',
  required = false,
  onCreateNew,
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
          prev < filteredPeople.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPeople.length > 0 && filteredPeople[highlightedIndex]) {
          handleSelect(filteredPeople[highlightedIndex]);
        } else if (filteredPeople.length === 0 && searchTerm && onCreateNew) {
          // No results - trigger create new
          onCreateNew(searchTerm);
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
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />

      {isOpen && filteredPeople.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredPeople.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelect(person)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
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
              <div className="text-gray-900 dark:text-white">
                {formatFullName(person)}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && searchTerm && filteredPeople.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No people found matching &quot;{searchTerm}&quot;
            </p>
            {onCreateNew && (
              <button
                type="button"
                onClick={() => onCreateNew(searchTerm)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
