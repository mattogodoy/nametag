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
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Search people..."
          className="w-full pl-9 pr-3 py-1.5 text-sm border-2 border-border rounded-lg bg-surface-elevated text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
          autoComplete="off"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {isOpen && isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-surface border-2 border-primary/30 rounded-lg shadow-lg shadow-primary/20 p-3">
          <p className="text-sm text-muted">Searching...</p>
        </div>
      )}

      {isOpen && !isLoading && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border-2 border-primary/30 rounded-lg shadow-lg shadow-primary/20 max-h-96 overflow-auto">
          {results.map((person, index) => (
            <button
              key={person.id}
              type="button"
              onClick={() => handleSelect(person)}
              className={`w-full text-left px-4 py-2.5 hover:bg-surface-elevated transition-colors text-sm border-l-2 ${
                index === highlightedIndex
                  ? 'bg-primary/10 border-l-primary'
                  : 'border-l-transparent'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="text-foreground font-medium">
                {formatFullName(person)}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isLoading && searchTerm && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border-2 border-tertiary/30 rounded-lg shadow-lg shadow-tertiary/20 p-3">
          <p className="text-sm text-muted">
            No people found matching &quot;{searchTerm}&quot;
          </p>
        </div>
      )}
    </div>
  );
}
