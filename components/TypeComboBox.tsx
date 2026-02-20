'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';

interface TypeComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  className?: string;
}

export default function TypeComboBox({
  value,
  onChange,
  options,
  placeholder = '',
  className = '',
}: TypeComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSelectingRef = useRef(false);
  const listboxId = useId();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlighted index when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting UI state when dropdown closes is intentional
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const handleSelect = useCallback((optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
    isSelectingRef.current = true;
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev
          );
        }
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        }
        break;
      }
      case 'Enter': {
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
          event.preventDefault();
          handleSelect(options[highlightedIndex].value);
        }
        break;
      }
      case 'Escape': {
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
        }
        break;
      }
    }
  }, [isOpen, highlightedIndex, options, handleSelect]);

  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  const activeDescendant =
    isOpen && highlightedIndex >= 0 ? getOptionId(highlightedIndex) : undefined;

  return (
    <div ref={dropdownRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          onFocus={() => {
            if (isSelectingRef.current) {
              isSelectingRef.current = false;
              return;
            }
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendant}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Toggle options"
          tabIndex={-1}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={getOptionId(index)}
              role="option"
              aria-selected={option.value === value}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full px-3 py-2 text-left text-sm cursor-pointer text-gray-900 dark:text-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                index === highlightedIndex
                  ? 'bg-gray-100 dark:bg-gray-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
