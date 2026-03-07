'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import type { WizardData } from './Step1ServerConfig';

export interface AddressBookOption {
  url: string;
  displayName: string | null;
  description: string | null;
}

interface Step2AddressBookSelectProps {
  data: WizardData;
  addressBooks: AddressBookOption[];
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2AddressBookSelect({
  data,
  addressBooks,
  onUpdate,
  onNext,
  onBack,
}: Step2AddressBookSelectProps) {
  const tw = useTranslations('settings.carddav.wizard');

  const [selectedUrl, setSelectedUrl] = useState<string>(
    data.addressBookUrl || addressBooks[0]?.url || ''
  );

  const handleSelect = (url: string) => {
    setSelectedUrl(url);
    const book = addressBooks.find(ab => ab.url === url);
    onUpdate({
      addressBookUrl: url,
      addressBookName: book?.displayName || null,
    });
  };

  // Auto-select first if nothing selected yet
  if (!data.addressBookUrl && addressBooks.length > 0) {
    const first = addressBooks[0];
    onUpdate({
      addressBookUrl: first.url,
      addressBookName: first.displayName || null,
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {tw('step2abDescription')}
      </p>

      {/* Address book list */}
      <div className="space-y-2">
        {addressBooks.map((book) => (
          <label
            key={book.url}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              selectedUrl === book.url
                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                : 'border-border hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <input
              type="radio"
              name="addressBook"
              value={book.url}
              checked={selectedUrl === book.url}
              onChange={() => handleSelect(book.url)}
              className="mt-1 h-4 w-4 text-primary focus:ring-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {book.displayName || tw('addressBookNoName')}
              </p>
              <p className="text-xs text-muted mt-0.5 truncate">
                {book.description || tw('addressBookNoDescription')}
              </p>
            </div>
          </label>
        ))}
      </div>

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border">
        <Button type="button" onClick={onBack} variant="secondary">
          {tw('back')}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!selectedUrl}
        >
          {tw('next')}
        </Button>
      </div>
    </div>
  );
}
