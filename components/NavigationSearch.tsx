'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatFullName } from '@/lib/nameUtils';
import PersonAvatar from './PersonPhoto';

interface Person {
  id: string;
  name: string;
  surname?: string | null;
  nickname?: string | null;
  photo?: string | null;
}

export default function NavigationSearch() {
  const router = useRouter();
  const t = useTranslations('nav.search');
  const [results, setResults] = useState<Person[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [nameOrder, setNameOrder] = useState<'WESTERN' | 'EASTERN'>('WESTERN');

  // Fetch user's name order preference
  useEffect(() => {
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(data => {
        if (data.user?.nameOrder) {
          setNameOrder(data.user.nameOrder);
        }
      })
      .catch(() => {
        // Silently fall back to WESTERN
      });
  }, []);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K global shortcut to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

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
        setHighlightedIndex((prev) => {
          const next = prev < results.length - 1 ? prev + 1 : prev;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          itemRefs.current.get(next)?.scrollIntoView({ block: 'nearest' });
          return next;
        });
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
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={t('placeholder')}
          className="w-full pl-9 pr-12 py-1.5 text-base sm:text-sm border border-border rounded-lg bg-surface-elevated text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
          autoComplete="off"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted bg-background border border-border rounded">
          <span className="text-xs">⌘</span>K
        </kbd>
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
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted">{t('searching')}</p>
        </div>
      )}

      {isOpen && !isLoading && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg max-h-96 overflow-auto">
          {results.map((person, index) => (
            <button
              key={person.id}
              ref={(el) => {
                if (el) itemRefs.current.set(index, el);
                else itemRefs.current.delete(index);
              }}
              type="button"
              onClick={() => handleSelect(person)}
              className={`w-full text-left px-4 py-2.5 hover:bg-surface-elevated transition-colors text-sm border-l-2 ${
                index === highlightedIndex
                  ? 'bg-primary/10 border-l-primary'
                  : 'border-l-transparent'
              }`}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className="flex items-center gap-2 text-foreground font-medium">
                <PersonAvatar personId={person.id} name={formatFullName(person, nameOrder)} photo={person.photo} size={24} />
                {formatFullName(person, nameOrder)}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && !isLoading && searchTerm && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted">
            {t('noResults', { searchTerm })}
          </p>
        </div>
      )}
    </div>
  );
}
