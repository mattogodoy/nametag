'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { personToVCardV3 } from '@/lib/vcard-v3';
import { addPhotoToVCardV3, downloadVcf, generateVcfFilename } from '@/lib/vcard-v3-helpers';
import type { PersonWithRelations } from '@/lib/carddav/types';
import { toast } from 'sonner';

interface PersonVCardExportProps {
  person: PersonWithRelations;
}

export default function PersonVCardExport({ person }: PersonVCardExportProps) {
  const t = useTranslations('people');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Generate base vCard
      let vcard = personToVCardV3(person, {
        includePhoto: false, // Will add separately
        includeCustomFields: true,
        stripMarkdown: false,
      });

      // Add photo if present
      if (person.photo) {
        vcard = await addPhotoToVCardV3(vcard, person.photo);
      }

      // Generate filename from person's name
      const fullName = [person.name, person.surname].filter(Boolean).join(' ') || 'contact';
      const filename = generateVcfFilename(fullName);

      // Download file
      downloadVcf(vcard, filename);

      toast.success(t('vcfExportSuccess', { filename }));
    } catch (error) {
      console.error('Failed to export vCard:', error);
      toast.error(t('vcfExportError'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="flex-1 sm:flex-none px-4 py-2 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors shadow-lg hover:shadow-secondary/50 text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      title={t('exportVcf')}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span className="hidden sm:inline">
        {isExporting ? t('exportingVcf') : t('exportVcf')}
      </span>
    </button>
  );
}
