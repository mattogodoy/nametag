'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import GroupsSelector from './GroupsSelector';

interface Group {
  id: string;
  name: string;
  color: string | null;
}

interface AccountManagementProps {
  groups: Group[];
}

export default function AccountManagement({ groups }: AccountManagementProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [exportMode, setExportMode] = useState<'all' | 'groups'>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    groups: number;
    people: number;
    customRelationshipTypes: number;
  } | null>(null);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Export data
  const handleExport = async () => {
    setIsExporting(true);
    setExportMessage('');

    try {
      const exportUrl = exportMode === 'groups' && selectedGroupIds.length > 0
        ? `/api/user/export?groupIds=${selectedGroupIds.join(',')}`
        : '/api/user/export';
      const response = await fetch(exportUrl);

      if (!response.ok) {
        setExportMessage('Failed to export data');
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

      setExportMessage('Data exported successfully');
      setTimeout(() => setExportMessage(''), 3000);
    } catch (error) {
      setExportMessage('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate and preview
      if (data.version && data.groups && data.people) {
        setImportPreview({
          groups: data.groups.length,
          people: data.people.length,
          customRelationshipTypes: data.customRelationshipTypes?.length || 0,
        });
      } else {
        setImportMessage('Invalid file format');
        setImportFile(null);
        setImportPreview(null);
      }
    } catch (error) {
      setImportMessage('Invalid JSON file');
      setImportFile(null);
      setImportPreview(null);
    }
  };

  // Import data
  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    setImportMessage('');

    try {
      const text = await importFile.text();
      const data = JSON.parse(text);

      const response = await fetch('/api/user/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportMessage(result.error || 'Failed to import data');
        return;
      }

      setImportMessage(
        `Successfully imported ${result.imported.groups} groups, ${result.imported.people} people, and ${result.imported.customRelationshipTypes} custom relationship types`
      );
      setImportFile(null);
      setImportPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Refresh the page to show imported data
      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (error) {
      setImportMessage('Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }

    if (!deletePassword) {
      setDeleteError('Password is required');
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
        setDeleteError(data.error || 'Failed to delete account');
        return;
      }

      // Sign out and redirect to login
      await signOut({ redirect: true, callbackUrl: '/login' });
    } catch (error) {
      setDeleteError('Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Export Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Export Data
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Download your data as a JSON file. This includes people, groups,
          relationships, and custom relationship types.
        </p>

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
                className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Export everything</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="exportMode"
                value="groups"
                checked={exportMode === 'groups'}
                onChange={() => setExportMode('groups')}
                disabled={groups.length === 0}
                className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className={`text-sm ${groups.length === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                Export specific groups
              </span>
            </label>
          </div>

          {exportMode === 'groups' && (
            <div className="pl-6">
              <GroupsSelector
                availableGroups={groups}
                selectedGroupIds={selectedGroupIds}
                onChange={setSelectedGroupIds}
              />
              {selectedGroupIds.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Will export people in selected groups, their group memberships, and relationships between them.
                </p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || (exportMode === 'groups' && selectedGroupIds.length === 0)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? 'Exporting...' : 'Export Data'}
        </button>
        {exportMessage && (
          <p
            className={`mt-2 text-sm ${
              exportMessage.includes('success')
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {exportMessage}
          </p>
        )}
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Import Data
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Import data from a previously exported JSON file. This will add to your
          existing data without removing anything.
        </p>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-8 h-8 text-gray-400 dark:text-gray-500"
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
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {importFile.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Click to choose a different file
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Click to select a JSON file
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    or drag and drop
                  </p>
                </div>
              )}
            </div>
          </button>

          {importPreview && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                Import Preview
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                <li>• {importPreview.groups} groups</li>
                <li>• {importPreview.people} people</li>
                <li>• {importPreview.customRelationshipTypes} custom relationship types</li>
              </ul>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
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
      <div className="border-t border-gray-300 dark:border-gray-600 pt-8">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          Delete Account
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Permanently delete your account and all associated data. This action cannot
          be undone.
        </p>

        {!showDeleteDialog ? (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
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
                  Warning: This is permanent!
                </h4>
                <p className="text-sm text-red-800 dark:text-red-400 mb-4">
                  All your data including people, groups, relationships, and custom
                  relationship types will be permanently deleted. We recommend exporting
                  your data first.
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
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirm your password
              </label>
              <input
                type="password"
                id="delete-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label
                htmlFor="delete-confirmation"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletePassword('');
                  setDeleteConfirmation('');
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
