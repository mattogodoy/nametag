'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function AccountManagement() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    groups: number;
    people: number;
    customRelationshipTypes: number;
  } | null>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setExportMessage('');

    try {
      const response = await fetch('/api/user/export');

      if (!response.ok) {
        setExportMessage('Failed to export data');
        return;
      }

      const data = await response.json();

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

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportMessage('');

    try {
      const text = await file.text();
      const data = JSON.parse(text);

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

      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (error) {
      setImportMessage('Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

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
        <h3 className="text-lg font-semibold mb-2">
          Export Data
        </h3>
        <p className="text-sm text-base-content/60 mb-4">
          Download all your data as a JSON file. This includes people, groups,
          relationships, and custom relationship types.
        </p>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn btn-primary"
        >
          {isExporting && <span className="loading loading-spinner loading-sm" />}
          <span className="icon-[tabler--download] size-4" />
          {isExporting ? 'Exporting...' : 'Export Data'}
        </button>
        {exportMessage && (
          <div className={`mt-2 text-sm ${exportMessage.includes('success') ? 'text-success' : 'text-error'}`}>
            {exportMessage}
          </div>
        )}
      </div>

      {/* Import Section */}
      <div>
        <h3 className="text-lg font-semibold mb-2">
          Import Data
        </h3>
        <p className="text-sm text-base-content/60 mb-4">
          Import data from a previously exported JSON file. This will add to your
          existing data without removing anything.
        </p>

        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="file-input file-input-bordered w-full"
          />

          {importPreview && (
            <div className="alert alert-info">
              <span className="icon-[tabler--info-circle] size-5" />
              <div>
                <h4 className="font-medium mb-1">Import Preview</h4>
                <ul className="text-sm space-y-1">
                  <li>{importPreview.groups} groups</li>
                  <li>{importPreview.people} people</li>
                  <li>{importPreview.customRelationshipTypes} custom relationship types</li>
                </ul>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="btn btn-sm btn-primary mt-3"
                >
                  {isImporting && <span className="loading loading-spinner loading-xs" />}
                  {isImporting ? 'Importing...' : 'Confirm Import'}
                </button>
              </div>
            </div>
          )}

          {importMessage && (
            <div className={`text-sm ${importMessage.includes('Success') ? 'text-success' : 'text-error'}`}>
              {importMessage}
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Section */}
      <div className="divider" />

      <div>
        <h3 className="text-lg font-semibold text-error mb-2">
          Delete Account
        </h3>
        <p className="text-sm text-base-content/60 mb-4">
          Permanently delete your account and all associated data. This action cannot
          be undone.
        </p>

        {!showDeleteDialog ? (
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="btn btn-error"
          >
            <span className="icon-[tabler--trash] size-4" />
            Delete Account
          </button>
        ) : (
          <div className="alert alert-error">
            <div className="w-full">
              <div className="flex items-start gap-3">
                <span className="icon-[tabler--alert-triangle] size-6 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold mb-2">
                    Warning: This is permanent!
                  </h4>
                  <p className="text-sm mb-4">
                    All your data including people, groups, relationships, and custom
                    relationship types will be permanently deleted. We recommend exporting
                    your data first.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="bg-error-content/20 p-3 rounded-lg mb-4">
                  {deleteError}
                </div>
              )}

              <div className="space-y-4">
                <div className="form-control">
                  <label htmlFor="delete-password" className="label">
                    <span className="label-text">Confirm your password</span>
                  </label>
                  <input
                    type="password"
                    id="delete-password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="input input-bordered"
                  />
                </div>

                <div className="form-control">
                  <label htmlFor="delete-confirmation" className="label">
                    <span className="label-text">Type <strong>DELETE</strong> to confirm</span>
                  </label>
                  <input
                    type="text"
                    id="delete-confirmation"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="input input-bordered"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                    className="btn btn-error"
                  >
                    {isDeleting && <span className="loading loading-spinner loading-sm" />}
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
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
