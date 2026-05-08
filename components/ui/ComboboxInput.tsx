'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxInputProps {
  options: ComboboxOption[];
  value: string | null;
  customText?: string;
  onChange: (value: string | null, customText?: string) => void;
  placeholder?: string;
  otherLabel?: string;
  id?: string;
  disabled?: boolean;
}

export default function ComboboxInput({
  options,
  value,
  customText = '',
  onChange,
  placeholder,
  otherLabel = 'Other...',
  id,
  disabled = false,
}: ComboboxInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localText, setLocalText] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Use local text while typing, fall back to prop
  const inputText = localText ?? customText;
  const setInputText = (text: string) => setLocalText(text);

  const filteredOptions = inputText && !value
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(inputText.toLowerCase())
      )
    : options;

  const selectedOption = value
    ? options.find((opt) => opt.value === value)
    : null;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!value && inputText.trim()) {
          onChange(null, inputText.trim());
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, inputText, onChange]);

  const handleSelectOption = useCallback((optionValue: string) => {
    onChange(optionValue);
    setLocalText(null);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange]);

  const handleSelectOther = useCallback(() => {
    onChange(null, '');
    setLocalText(null);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null, '');
    setLocalText(null);
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    onChange(null, text);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    const totalItems = filteredOptions.length + 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0) {
          if (highlightedIndex < filteredOptions.length) {
            handleSelectOption(filteredOptions[highlightedIndex].value);
          } else {
            handleSelectOther();
          }
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center">
        {selectedOption ? (
          <div
            className="w-full flex items-center justify-between px-3 py-2 text-sm border border-border rounded-lg bg-surface text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
          >
            <span>{selectedOption.label}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="w-full relative">
            <input
              ref={inputRef}
              type="text"
              id={id}
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full px-3 py-2 pr-8 text-base sm:text-sm border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={listboxId}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => !disabled && setIsOpen(!isOpen)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isOpen && !disabled && (
        <div id={listboxId} className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden" role="listbox">
          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              onClick={() => handleSelectOption(option.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectOption(option.value); } }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                highlightedIndex === index
                  ? 'bg-primary text-white'
                  : option.value === value
                    ? 'bg-surface-elevated text-primary'
                    : 'text-foreground hover:bg-surface-elevated'
              }`}
              role="option"
              tabIndex={0}
              aria-selected={option.value === value}
            >
              {option.label}
            </div>
          ))}
          <div className="border-t border-border">
            <div
              onClick={handleSelectOther}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectOther(); } }}
              className={`w-full text-left px-3 py-2 text-sm italic transition-colors cursor-pointer ${
                highlightedIndex === filteredOptions.length
                  ? 'bg-primary text-white'
                  : 'text-muted hover:bg-surface-elevated'
              }`}
              role="option"
              tabIndex={0}
              aria-selected={false}
            >
              {otherLabel}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
