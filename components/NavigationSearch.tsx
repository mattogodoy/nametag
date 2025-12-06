'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatFullName } from '@/lib/nameUtils';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
}

export default function NavigationSearch() {
  const router = useRouter();
  const [results, setResults] = useState<Person[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced server-side search
  const performSearch = useCallback(async (query: string) => {
    if (query.length === 0) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/people/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.people && Array.isArray(data.people)) {
        setResults(data.people);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, performSearch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
  };

  const handleSelect = (person: Person) => {
    setSearchTerm('');
    setIsOpen(false);
    inputRef.current?.blur();
    router.push(`/people/${person.id}`);
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
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => {
    if (searchTerm || results.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-64">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 icon-[tabler--search] size-4 text-base-content/50" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Search people..."
          className="input input-sm w-full pl-9"
          autoComplete="off"
        />
      </div>

      {isOpen && isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-base-200 rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-xs" />
            Searching...
          </div>
        </div>
      )}

      {isOpen && !isLoading && results.length > 0 && (
        <ul className="menu absolute z-50 w-full mt-1 bg-base-200 rounded-lg shadow-lg max-h-96 overflow-auto p-1">
          {results.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => handleSelect(person)}
                className={index === highlightedIndex ? 'active' : ''}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="icon-[tabler--user] size-4" />
                {formatFullName(person)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isLoading && searchTerm && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-base-200 rounded-lg shadow-lg p-3">
          <p className="text-sm text-base-content/60">
            No people found matching &quot;{searchTerm}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
