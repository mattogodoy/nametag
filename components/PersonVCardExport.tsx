'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { personToVCard } from '@/lib/vcard';
import { addPhotoToVCardFromUrl, downloadVcf, generateVcfFilename } from '@/lib/vcard-helpers';
import type { PersonWithRelations } from '@/lib/carddav/types';
import { getPhotoUrl } from '@/lib/photo-url';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '@/components/ui/Modal';

interface PersonVCardExportProps {
  person: PersonWithRelations;
}

export default function PersonVCardExport({ person }: PersonVCardExportProps) {
  const t = useTranslations('people');
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [vCardData, setVCardData] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateVCard = async (): Promise<string> => {
    // Generate base vCard
    const vcard = personToVCard(person, {
      includePhoto: false, // Photos make QR codes too large
      includeCustomFields: true,
      stripMarkdown: false,
    });

    return vcard;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setShowDropdown(false);

    try {
      // Generate base vCard
      let vcard = personToVCard(person, {
        includePhoto: false, // Will add separately
        includeCustomFields: true,
        stripMarkdown: false,
      });

      // Add photo if present
      const photoUrl = getPhotoUrl(person.id, person.photo);
      if (photoUrl) {
        vcard = await addPhotoToVCardFromUrl(vcard, photoUrl);
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

  const handleShowQr = async () => {
    setShowDropdown(false);
    setIsExporting(true);

    try {
      const vcard = await generateVCard();
      setVCardData(vcard);
      setShowQrModal(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast.error(t('qrCodeError'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isExporting}
          className="px-4 py-2 bg-secondary text-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors shadow-lg hover:shadow-secondary/50 text-center disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          title={t('exportVcf')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden sm:inline">
            {isExporting ? t('exportingVcf') : t('exportVcf')}
          </span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute bottom-full mb-2 right-0 w-56 bg-surface border border-border rounded-lg shadow-xl z-50">
            <div className="py-1">
              <button
                onClick={handleExport}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('downloadVcardFile')}
              </button>
              <button
                onClick={handleShowQr}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                {t('showContactQr')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      <Modal isOpen={showQrModal} onClose={() => setShowQrModal(false)} title={t('contactQrCode')}>
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG
              value={vCardData}
              size={256}
              level="M"
              includeMargin={true}
            />
          </div>
          <p className="text-sm text-muted mt-4 text-center">
            {t('qrCodeInstructions')}
          </p>
          <p className="text-xs text-muted mt-2 text-center">
            {[person.name, person.surname].filter(Boolean).join(' ')}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowQrModal(false)}
            className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            {t('close')}
          </button>
        </div>
      </Modal>
    </>
  );
}
