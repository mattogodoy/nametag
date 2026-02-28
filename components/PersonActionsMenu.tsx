'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { personToVCard } from '@/lib/vcard';
import { addPhotoToVCardFromUrl, downloadVcf, generateVcfFilename } from '@/lib/vcard-helpers';
import type { PersonWithRelations } from '@/lib/carddav/types';
import { getPhotoUrl } from '@/lib/photo-url';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '@/components/ui/Modal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { DuplicateCandidateDisplay } from '@/components/DuplicatesList';

interface PersonActionsMenuProps {
  personId: string;
  personName: string;
  person: PersonWithRelations;
  hasCardDavSync: boolean;
}

interface Orphan {
  id: string;
  fullName: string;
}

export default function PersonActionsMenu({
  personId,
  personName,
  person,
  hasCardDavSync,
}: PersonActionsMenuProps) {
  const t = useTranslations('people');
  const tDup = useTranslations('people.duplicates');
  const router = useRouter();

  // Dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Duplicates state
  const [dupOpen, setDupOpen] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [candidates, setCandidates] = useState<DuplicateCandidateDisplay[] | null>(null);
  const dupRef = useRef<HTMLDivElement>(null);

  // VCard export state
  const [isExporting, setIsExporting] = useState(false);

  // QR modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [vCardData, setVCardData] = useState<string>('');

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [deleteOrphans, setDeleteOrphans] = useState(false);
  const [deleteFromCardDav, setDeleteFromCardDav] = useState(false);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close duplicates popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dupRef.current && !dupRef.current.contains(event.target as Node)) {
        setDupOpen(false);
      }
    }
    if (dupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dupOpen]);

  // Keyboard handling for menu
  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
    }
  }, []);

  // Fetch orphans when delete modal opens
  useEffect(() => {
    if (showDeleteConfirm) {
      const controller = new AbortController();
      fetch(`/api/people/${personId}/orphans`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          setOrphans(data.orphans || []);
          setIsLoadingOrphans(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoadingOrphans(false);
        });
      return () => controller.abort();
    }
  }, [showDeleteConfirm, personId]);

  // --- Actions ---

  const handleFindDuplicates = async () => {
    setMenuOpen(false);

    if (dupOpen) {
      setDupOpen(false);
      return;
    }

    setDupOpen(true);
    setDupLoading(true);
    setCandidates(null);

    try {
      const res = await fetch(`/api/people/${personId}/duplicates`);
      if (res.ok) {
        const data: { duplicates: DuplicateCandidateDisplay[] } = await res.json();
        setCandidates(data.duplicates);
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    } finally {
      setDupLoading(false);
    }
  };

  const handleExport = async () => {
    setMenuOpen(false);
    setIsExporting(true);

    try {
      let vcard = personToVCard(person, {
        includePhoto: false,
        includeCustomFields: true,
        stripMarkdown: false,
      });

      const photoUrl = getPhotoUrl(person.id, person.photo);
      if (photoUrl) {
        vcard = await addPhotoToVCardFromUrl(vcard, photoUrl);
      }

      const fullName = [person.name, person.surname].filter(Boolean).join(' ') || 'contact';
      const filename = generateVcfFilename(fullName);
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
    setMenuOpen(false);
    setIsExporting(true);

    try {
      const vcard = personToVCard(person, {
        includePhoto: false,
        includeCustomFields: true,
        stripMarkdown: false,
      });
      setVCardData(vcard);
      setShowQrModal(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast.error(t('qrCodeError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteOpen = () => {
    setMenuOpen(false);
    setDeleteError(null);
    setDeleteOrphans(false);
    setDeleteFromCardDav(false);
    setOrphans([]);
    setIsLoadingOrphans(true);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/people/${personId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteOrphans,
          orphanIds: orphans.map((o) => o.id),
          deleteFromCardDav,
        }),
      });

      if (response.ok) {
        router.push('/people');
        router.refresh();
      } else {
        const data = await response.json();
        setDeleteError(data.error || t('deletePersonFailed'));
        setIsDeleting(false);
      }
    } catch {
      setDeleteError(t('connectionError'));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef} onKeyDown={handleMenuKeyDown}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isExporting}
          className="h-[42px] px-2 py-2 border border-border text-foreground rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
          aria-label={t('actions')}
          title={t('actions')}
>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-surface border border-border rounded-lg shadow-xl z-50">
            <div className="py-1">
              {/* Find Duplicates */}
              <button
                onClick={handleFindDuplicates}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {tDup('findDuplicates')}
              </button>

              {/* Export VCF */}
              <button
                onClick={handleExport}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {t('downloadVcardFile')}
              </button>

              {/* Show QR */}
              <button
                onClick={handleShowQr}
                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                {t('showContactQr')}
              </button>

              {/* Separator */}
              <div className="border-t border-border my-1" />

              {/* Delete */}
              <button
                onClick={handleDeleteOpen}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-surface-elevated transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('delete')}
              </button>
            </div>
          </div>
        )}

        {/* Duplicates Popover */}
        {dupOpen && (
          <div ref={dupRef} className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-20 p-4">
          {dupLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          )}

          {!dupLoading && candidates !== null && candidates.length === 0 && (
            <p className="text-sm text-muted py-2">{tDup('noDuplicates')}</p>
          )}

          {!dupLoading && candidates !== null && candidates.length > 0 && (
            <div className="space-y-2">
              {candidates.map((candidate) => (
                <div
                  key={candidate.personId}
                  className="flex items-center justify-between gap-2 p-2 bg-surface-elevated rounded-lg"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {[candidate.name, candidate.surname].filter(Boolean).join(' ')}
                    </span>
                    <span className="text-xs text-muted">
                      {tDup('similarity', { score: Math.round(candidate.similarity * 100) })}
                    </span>
                  </div>
                  <Link
                    href={`/people/merge?primary=${personId}&secondary=${candidate.personId}`}
                    className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded bg-primary text-white hover:bg-primary-dark transition-colors flex-shrink-0"
                  >
                    {tDup('merge')}
                  </Link>
                </div>
              ))}
            </div>
          )}
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('deletePersonTitle')}
        confirmText={t('delete')}
        confirmDisabled={isLoadingOrphans}
        isLoading={isDeleting}
        loadingText={t('deleting')}
        error={deleteError}
        variant="danger"
      >
        <p className="text-muted mb-1">
          {t('deletePersonConfirm', { name: personName })}
        </p>
        <p className="text-muted mb-4">
          {t('canRestoreWithin30Days')}
        </p>

        {isLoadingOrphans && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded text-sm">
            {t('checkingOrphans')}
          </div>
        )}

        {!isLoadingOrphans && orphans.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 rounded">
            <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">
              {t('orphanWarningNote')}
            </p>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mb-3 space-y-1">
              {orphans.map((orphan) => (
                <li key={orphan.id}>
                  <a
                    href={`/people/${orphan.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {orphan.fullName}
                    <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="deleteOrphans"
                checked={deleteOrphans}
                onChange={(e) => setDeleteOrphans(e.target.checked)}
                className="w-4 h-4 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
              />
              <label htmlFor="deleteOrphans" className="ml-2 text-sm text-yellow-800 dark:text-yellow-400 cursor-pointer">
                {t('deleteToo')}
              </label>
            </div>
          </div>
        )}

        {hasCardDavSync && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 rounded">
            <div className="flex items-start">
              <input
                type="checkbox"
                id="deleteFromCardDav"
                checked={deleteFromCardDav}
                onChange={(e) => setDeleteFromCardDav(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
              />
              <label htmlFor="deleteFromCardDav" className="ml-2 text-sm text-blue-800 dark:text-blue-400 cursor-pointer">
                {t('deleteFromCardDavServer')}
              </label>
            </div>
            <p className="ml-6 mt-1 text-xs text-blue-700 dark:text-blue-300">
              {t('deleteFromCardDavServerDescription')}
            </p>
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}
