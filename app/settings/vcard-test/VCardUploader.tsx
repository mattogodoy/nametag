'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseVCard } from '@/lib/carddav/vcard-parser';
import type { ParsedVCardDataEnhanced } from '@/lib/carddav/vcard-parser';

interface VCardUploaderProps {
  onVCardUploaded: (vCardText: string, parsedData: ParsedVCardDataEnhanced) => void;
  onError: (error: string) => void;
}

export default function VCardUploader({ onVCardUploaded, onError }: VCardUploaderProps) {
  const t = useTranslations('settings.vcardTest');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // Validate file extension
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.vcf') && !fileName.endsWith('.vcard')) {
        onError(t('errors.invalidFile'));
        return;
      }

      setSelectedFile(file);

      try {
        // Read file as text
        const text = await file.text();

        // Validate that it's a vCard (contains BEGIN:VCARD)
        if (!text.includes('BEGIN:VCARD')) {
          onError(t('errors.invalidFile'));
          return;
        }

        // Parse the vCard
        const parsed = parseVCard(text);

        // Call the success callback
        onVCardUploaded(text, parsed);
      } catch (err) {
        console.error('Error parsing vCard:', err);
        onError(t('errors.parseFailed'));
      }
    },
    [onVCardUploaded, onError, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-surface hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <input
          type="file"
          accept=".vcf,.vcard"
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-muted"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-foreground">{t('fileSelected')}</p>
              <p className="text-xs text-muted mt-1">{selectedFile.name}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                {t('clickToChooseDifferent')}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted">{t('dropzone')}</p>
              <p className="text-xs text-muted mt-1">(.vcf, .vcard)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
