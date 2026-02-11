'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import GroupsSelector from './GroupsSelector';
import { Button } from './ui/Button';
import { useTranslations } from 'next-intl';
import { importDataSchema } from '@/lib/validations';
import { z } from 'zod';
import { personToVCardV3 } from '@/lib/vcard-v3';
import {
  addPhotoToVCardV3,
  downloadVcf,
  generateBulkVcfFilename,
  exportPeopleWithProgress,
} from '@/lib/vcard-v3-helpers';
import { toast } from 'sonner';

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface AccountManagementProps {
  groups: Group[];
  peopleCount: number;
}

type ImportData = z.infer<typeof importDataSchema>;

export default function AccountManagement({ groups, peopleCount }: AccountManagementProps) {
  const t = useTranslations('settings.account');
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingVcard, setIsExportingVcard] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportMode, setExportMode] = useState<'all' | 'groups'>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [vcardProgress, setVcardProgress] = useState<{ current: number; total: number } | null>(null);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ImportData | null>(null);
  const [importPreview, setImportPreview] = useState<{
    groups: number;
    people: number;
    customRelationshipTypes: number;
  } | null>(null);
  const [importValidation, setImportValidation] = useState<{
    valid: boolean;
    error?: string;
    message?: string;
    newPeopleCount?: number;
    newGroupsCount?: number;
    current?: number;
    limit?: number;
    totalAfterImport?: number;
  } | null>(null);
  const [importMode, setImportMode] = useState<'all' | 'groups'>('all');
  const [selectedImportGroupIds, setSelectedImportGroupIds] = useState<string[]>([]);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Export JSON data
  const handleExportJson = async () => {
    setIsExportingJson(true);
    setExportMessage('');

    try {
      const exportUrl = exportMode === 'groups' && selectedGroupIds.length > 0
        ? `/api/user/export?groupIds=${selectedGroupIds.join(',')}`
        : '/api/user/export';
      const response = await fetch(exportUrl);

      if (!response.ok) {
        setExportMessage(t('exportFailed'));
        return;
      }

      const data = await response.json();

      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nametag-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('exportSuccess'));
    } catch {
      toast.error(t('exportFailed'));
    } finally {
      setIsExportingJson(false);
    }
  };

  // Export vCard data
  const handleExportVcard = async () => {
    setIsExportingVcard(true);
    setVcardProgress(null);

    try {
      // Build API endpoint based on export mode
      let endpoint = '/api/people?includeAll=true';

      if (exportMode === 'groups') {
        if (selectedGroupIds.length === 0) {
          toast.error(t('selectGroups'));
          setIsExportingVcard(false);
          return;
        }

        endpoint = `/api/people?groupIds=${selectedGroupIds.join(',')}&includeAll=true`;
      }

      // Fetch people data
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      const people = data.people || [];

      if (!people || people.length === 0) {
        toast.error(t('noDataToExport'));
        setIsExportingVcard(false);
        return;
      }

      // Convert to vCards
      const vcards: string[] = [];

      for (let i = 0; i < people.length; i++) {
        const person = people[i];

        // Generate base vCard
        let vcard = personToVCardV3(person, {
          includePhoto: false,
          includeCustomFields: true,
          stripMarkdown: false,
        });

        // Add photo if present
        if (person.photo) {
          try {
            vcard = await addPhotoToVCardV3(vcard, person.photo);
          } catch (error) {
            console.warn(`Failed to add photo for ${person.name}:`, error);
          }
        }

        vcards.push(vcard);

        // Update progress every 5 contacts
        if (i % 5 === 0 || i === people.length - 1) {
          setVcardProgress({ current: i + 1, total: people.length });
        }
      }

      // Combine vcards with progress updates
      const combinedVcf = await exportPeopleWithProgress(vcards, (prog) => {
        setVcardProgress(prog);
      });

      // Generate filename
      const filename = generateBulkVcfFilename(people.length);

      // Download file
      downloadVcf(combinedVcf, filename);

      toast.success(t('vcardExportSuccess', { count: people.length }));
    } catch (error) {
      console.error('Failed to export vCard:', error);
      toast.error(t('exportFailed'));
    } finally {
      setIsExportingVcard(false);
      setVcardProgress(null);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportMessage('');
    setImportValidation(null);
    setImportData(null);
    setImportMode('all');
    setSelectedImportGroupIds([]);
    setIsValidating(true);

    try {
      const text = await file.text();

      // Check if it's a vCard file
      if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard') || text.trim().startsWith('BEGIN:VCARD')) {
        // Handle vCard import
        setImportMessage(t('vcardImportNote'));
        setIsValidating(false);
        // For vCard, we'll import directly without preview
        await handleVcardImport(text);
        return;
      }

      // Otherwise, try to parse as JSON
      const data = JSON.parse(text);

      // Validate file format
      if (data.version && data.groups && data.people) {
        setImportData(data);
        setImportPreview({
          groups: data.groups.length,
          people: data.people.length,
          customRelationshipTypes: data.customRelationshipTypes?.length || 0,
        });

        // Validate against tier limits
        const validationResponse = await fetch('/api/user/import/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (validationResponse.ok) {
          const validationResult = await validationResponse.json();
          setImportValidation(validationResult);
        } else {
          setImportMessage(t('importFailed'));
          setImportFile(null);
          setImportData(null);
          setImportPreview(null);
        }
      } else {
        setImportMessage(t('invalidFileFormat'));
        setImportFile(null);
        setImportData(null);
        setImportPreview(null);
      }
    } catch {
      setImportMessage(t('invalidJSON'));
      setImportFile(null);
      setImportData(null);
      setImportPreview(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Handle vCard import
  const handleVcardImport = async (vcardText: string) => {
    setIsImporting(true);
    setImportMessage('');

    try {
      const response = await fetch('/api/vcard/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/vcard',
        },
        body: vcardText,
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || t('importFailed'));
        return;
      }

      const totalProcessed = result.imported + result.skipped + result.errors;
      if (result.imported > 0) {
        toast.success(t('vcardImportSuccess', { count: result.imported }));
      }
      if (result.skipped > 0) {
        toast.info(`${result.skipped} contacts skipped (already exist)`);
      }
      if (result.errors > 0) {
        toast.warning(`${result.errors} contacts failed to import`);
      }

      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the page to show imported data
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error('vCard import error:', error);
      toast.error(t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  // Import data
  const handleImport = async () => {
    if (!importFile || !importData) return;

    setIsImporting(true);
    setImportMessage('');

    try {
      // Build the request body
      const requestBody: Record<string, unknown> = { ...importData };

      // If importing specific groups, add the groupIds parameter
      if (importMode === 'groups' && selectedImportGroupIds.length > 0) {
        requestBody.groupIds = selectedImportGroupIds;
      }

      const response = await fetch('/api/user/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportMessage(result.error || 'Failed to import data');
        return;
      }

      setImportMessage(
        t('importSuccess', {
          groups: result.imported.groups,
          people: result.imported.people,
          types: result.imported.relationshipTypes || 0
        })
      );
      setImportFile(null);
      setImportData(null);
      setImportPreview(null);
      setImportMode('all');
      setSelectedImportGroupIds([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the page to show imported data
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch {
      setImportMessage(t('importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError(t('deleteError'));
      return;
    }

    if (!deletePassword) {
      setDeleteError(t('passwordRequired'));
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmationText: deleteConfirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || t('importFailed'));
        return;
      }

      // Sign out and redirect to login
      await signOut({ redirect: true, callbackUrl: '/login' });
    } catch {
      setDeleteError(t('importFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('exportData')}
        </h3>
        <p className="text-sm text-muted mb-4">
          {t('exportDescription')}
        </p>

        {/* Export Format Explanation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
            {t('exportFormats')}
          </h4>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
            <div>
              <span className="font-medium">{t('jsonFormat')}</span>: {t('jsonFormatDescription')}
            </div>
            <div>
              <span className="font-medium">{t('vcardFormat')}</span>: {t('vcardFormatDescription')}
            </div>
          </div>
        </div>

        {/* Export Mode Toggle */}
        <div className="mb-4 space-y-3">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportMode"
                value="all"
                checked={exportMode === 'all'}
                onChange={() => setExportMode('all')}
                disabled={peopleCount === 0 && groups.length === 0}
                className="w-4 h-4 text-blue-600 bg-surface-elevated border-border focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={`text-sm ${peopleCount === 0 && groups.length === 0 ? 'text-muted' : 'text-muted'}`}>
                {t('exportEverything')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportMode"
                value="groups"
                checked={exportMode === 'groups'}
                onChange={() => setExportMode('groups')}
                disabled={groups.length === 0}
                className="w-4 h-4 text-blue-600 bg-surface-elevated border-border focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={`text-sm ${groups.length === 0 ? 'text-muted' : 'text-muted'}`}>
                {t('exportSpecificGroups')}
              </span>
            </label>
          </div>

          {exportMode === 'groups' && (
            <div className="pl-6">
              <p className="text-sm text-muted mb-2">
                {t('selectGroups')}
              </p>
              <GroupsSelector
                availableGroups={groups}
                selectedGroupIds={selectedGroupIds}
                onChange={setSelectedGroupIds}
                allowCreate={false}
                placeholder={t('selectGroupsPlaceholder')}
              />
              {selectedGroupIds.length > 0 && (
                <p className="text-xs text-muted mt-2">
                  {t('willExport')}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleExportJson}
            disabled={
              isExportingJson ||
              isExportingVcard ||
              (exportMode === 'groups' && selectedGroupIds.length === 0) ||
              (exportMode === 'all' && peopleCount === 0 && groups.length === 0)
            }
          >
            {isExportingJson ? t('exporting') : t('exportJson')}
          </Button>

          <Button
            onClick={handleExportVcard}
            disabled={
              isExportingJson ||
              isExportingVcard ||
              (exportMode === 'groups' && selectedGroupIds.length === 0) ||
              (exportMode === 'all' && peopleCount === 0)
            }
            variant="secondary"
          >
            {isExportingVcard ? (vcardProgress ? t('exportingProgress', { current: vcardProgress.current, total: vcardProgress.total }) : t('exporting')) : t('exportVcard')}
          </Button>
        </div>

        {/* Show helpful message when no data to export */}
        {exportMode === 'all' && peopleCount === 0 && groups.length === 0 && (
          <p className="mt-2 text-sm text-muted">
            {t('noDataToExport')}
          </p>
        )}

        {/* Progress indicator for vCard export */}
        {vcardProgress && (
          <div className="mt-3 space-y-2">
            <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{
                  width: `${(vcardProgress.current / vcardProgress.total) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-muted text-center">
              {t('exportingProgress', { current: vcardProgress.current, total: vcardProgress.total })}
            </p>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('importData')}
        </h3>
        <p className="text-sm text-muted mb-4">
          {t('importDescription')}
        </p>

        {/* Import Format Explanation */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
            {t('importFormats')}
          </h4>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
            <div>
              <span className="font-medium">{t('jsonFormat')}</span>: {t('jsonImportDescription')}
            </div>
            <div>
              <span className="font-medium">{t('vcardFormat')}</span>: {t('vcardImportDescription')}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.vcf,.vcard"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-surface-elevated/50 transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              {importFile ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {importFile.name}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {t('clickToChooseDifferent')}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t('clickToSelect')}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {t('dragAndDrop')}
                  </p>
                </div>
              )}
            </div>
          </button>

          {isValidating && (
            <div className="bg-surface-elevated border border-border rounded-lg p-4">
              <p className="text-sm text-muted">
                {t('validatingImport')}
              </p>
            </div>
          )}

          {importPreview && !isValidating && importValidation && (
            <div className={`border rounded-lg p-4 ${
              importValidation.valid
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : 'bg-warning/10 border-2 border-warning'
            }`}>
              <h4 className={`font-medium mb-2 ${
                importValidation.valid
                  ? 'text-blue-900 dark:text-blue-300'
                  : 'text-warning'
              }`}>
                {importValidation.valid ? t('importPreview') : t('importLimitExceeded')}
              </h4>

              {importValidation.valid ? (
                <>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 mb-4">
                    <li>• {t('groupsNew', { count: importPreview.groups, newCount: importValidation.newGroupsCount || 0 })}</li>
                    <li>• {t('peopleNew', { count: importPreview.people, newCount: importValidation.newPeopleCount || 0 })}</li>
                    <li>• {t('customRelationshipTypes', { count: importPreview.customRelationshipTypes })}</li>
                  </ul>

                  {/* Import Mode Toggle - only show if there are groups */}
                  {importPreview.groups > 0 && importData && (
                    <div className="mb-4 space-y-3 border-t border-blue-200 dark:border-blue-700 pt-3">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="all"
                            checked={importMode === 'all'}
                            onChange={() => setImportMode('all')}
                            className="w-4 h-4 text-blue-600 bg-surface-elevated border-border focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-800 dark:text-blue-300">
                            {t('importEverything')}
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="importMode"
                            value="groups"
                            checked={importMode === 'groups'}
                            onChange={() => setImportMode('groups')}
                            className="w-4 h-4 text-blue-600 bg-surface-elevated border-border focus:ring-blue-500"
                          />
                          <span className="text-sm text-blue-800 dark:text-blue-300">
                            {t('importSpecificGroups')}
                          </span>
                        </label>
                      </div>

                      {importMode === 'groups' && (
                        <div className="pl-6">
                          <div className="space-y-2 mb-3">
                            {importData.groups.map((group) => (
                              <label
                                key={group.id}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedImportGroupIds.includes(group.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedImportGroupIds([...selectedImportGroupIds, group.id]);
                                    } else {
                                      setSelectedImportGroupIds(
                                        selectedImportGroupIds.filter(id => id !== group.id)
                                      );
                                    }
                                  }}
                                  className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <div
                                  className="w-4 h-4 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: group.color || '#9CA3AF',
                                  }}
                                />
                                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                  {group.name}
                                </span>
                              </label>
                            ))}
                          </div>
                          {selectedImportGroupIds.length > 0 && (
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              {t('willImport', {
                                count: selectedImportGroupIds.length,
                                type: selectedImportGroupIds.length === 1 ? t('group') : t('groups_plural'),
                                location: selectedImportGroupIds.length === 1 ? t('thisGroup') : t('thoseGroups')
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={isImporting || (importMode === 'groups' && selectedImportGroupIds.length === 0)}
                    className="mt-3 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? t('importing') : t('confirmImport')}
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-800 dark:text-red-400">
                    {importValidation.message}
                  </p>
                  <div className="text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/40 p-3 rounded">
                    <p className="font-medium mb-1">{t('currentUsage')}</p>
                    <ul className="space-y-1 ml-4">
                      <li>• {importValidation.error === 'people' ? t('people') : t('groups')}: {importValidation.current} / {importValidation.limit}</li>
                      <li>• {t('newFromImport', { count: (importValidation.newPeopleCount || importValidation.newGroupsCount || 0) })}</li>
                      <li>• {t('totalAfterImport', { count: importValidation.totalAfterImport || 0 })}</li>
                    </ul>
                  </div>
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportData(null);
                      setImportPreview(null);
                      setImportValidation(null);
                      setImportMode('all');
                      setSelectedImportGroupIds([]);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-surface-elevated text-foreground rounded-lg font-medium hover:bg-surface-elevated transition-colors"
                  >
                    {t('chooseDifferentFile')}
                  </button>
                </div>
              )}
            </div>
          )}

          {importMessage && (
            <p
              className={`text-sm ${
                importMessage.includes('Success')
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {importMessage}
            </p>
          )}
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="border-t border-border pt-8">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          {t('deleteAccount')}
        </h3>
        <p className="text-sm text-muted mb-4">
          {t('deleteAccountDescription')}
        </p>

        {!showDeleteDialog ? (
          <Button
            variant="danger"
            onClick={() => setShowDeleteDialog(true)}
          >
            {t('deleteAccountButton')}
          </Button>
        ) : (
          <div className="bg-warning/10 border-2 border-warning rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-warning flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-bold text-red-900 dark:text-red-300 mb-2">
                  {t('warningPermanent')}
                </h4>
                <p className="text-sm text-red-800 dark:text-red-400 mb-4">
                  {t('deleteWarningMessage')}
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {deleteError}
              </div>
            )}

            <div>
              <label
                htmlFor="delete-password"
                className="block text-sm font-medium text-muted mb-1"
              >
                {t('confirmPassword')}
              </label>
              <input
                type="password"
                id="delete-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label
                htmlFor="delete-confirmation"
                className="block text-sm font-medium text-muted mb-1"
              >
                {t('typeToConfirm')}
              </label>
              <input
                type="text"
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== 'DELETE'}
              >
                {isDeleting ? t('deleting') : t('deleteMyAccount')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletePassword('');
                  setDeleteConfirmation('');
                  setDeleteError('');
                }}
                disabled={isDeleting}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
