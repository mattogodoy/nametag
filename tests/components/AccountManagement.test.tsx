import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountManagement from '../../components/AccountManagement';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock next-auth
vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn((namespace: string) => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, Record<string, string>> = {
      'settings.account': {
        'exportData': 'Export Data',
        'exportDescription': 'Download your data',
        'exportFormats': 'Export Formats',
        'exportEverything': 'Export everything',
        'exportSpecificGroups': 'Export specific groups',
        'selectGroups': 'Select groups',
        'selectGroupsPlaceholder': 'Choose groups',
        'willExport': 'Will export',
        'noDataToExport': 'You don\'t have any data to export yet.',
        'exportJson': 'Export JSON',
        'exportVcard': 'Export vCard',
        'exporting': 'Exporting...',
        'exportSuccess': 'Data exported successfully!',
        'exportFailed': 'Failed to export data. Please try again.',
        'vcardExportSuccess': `${params?.count} contacts exported successfully!`,
        'jsonFormat': 'JSON',
        'jsonFormatDescription': 'Full backup format',
        'vcardFormat': 'vCard',
        'vcardFormatDescription': 'Standard contact format',
        'importData': 'Import Data',
        'importDescription': 'Upload your data',
        'importFormats': 'Import Formats',
        'jsonImportDescription': 'Import from backup',
        'vcardImportDescription': 'Import from vCard file',
        'clickToSelect': 'Click to select file',
        'dragAndDrop': 'or drag and drop',
        'clickToChooseDifferent': 'Click to choose different file',
        'validatingImport': 'Validating...',
        'importPreview': 'Import Preview',
        'importButton': 'Import',
        'importing': 'Importing...',
        'deleteAccount': 'Delete Account',
        'deleteAccountDescription': 'Permanently delete your account',
        'deleteAccountButton': 'Delete Account',
        'deleteMyAccount': 'Delete My Account',
        'deleting': 'Deleting...',
        'cancel': 'Cancel',
        'warningPermanent': 'Warning: This is permanent',
        'deleteWarningMessage': 'All your data will be deleted',
        'confirmPassword': 'Confirm your password',
        'typeToConfirm': 'Type DELETE to confirm',
      },
    };
    return translations[namespace]?.[key] || key;
  }),
}));

describe('AccountManagement - Export Data', () => {
  const mockGroups = [
    { id: 'group-1', name: 'Family', color: '#FF0000' },
    { id: 'group-2', name: 'Friends', color: '#00FF00' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  describe('When there is no data', () => {
    it('should disable export button when no people and no groups', () => {
      render(<AccountManagement groups={[]} peopleCount={0} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      expect(exportJsonButton).toBeDisabled();
    });

    it('should disable "Export everything" radio when no data', () => {
      render(<AccountManagement groups={[]} peopleCount={0} />);

      const exportAllRadio = screen.getByRole('radio', { name: /export everything/i });
      expect(exportAllRadio).toBeDisabled();
    });

    it('should show helpful message when no data to export', () => {
      render(<AccountManagement groups={[]} peopleCount={0} />);

      expect(screen.getByText(/You don't have any data to export yet/i)).toBeInTheDocument();
    });

    it('should disable "Export specific groups" when no groups exist', () => {
      render(<AccountManagement groups={[]} peopleCount={5} />);

      const exportGroupsRadio = screen.getByRole('radio', { name: /export specific groups/i });
      expect(exportGroupsRadio).toBeDisabled();
    });
  });

  describe('When there is data', () => {
    it('should enable export button when there are people', () => {
      render(<AccountManagement groups={[]} peopleCount={10} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      expect(exportJsonButton).not.toBeDisabled();
    });

    it('should enable export button when there are groups', () => {
      render(<AccountManagement groups={mockGroups} peopleCount={0} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      expect(exportJsonButton).not.toBeDisabled();
    });

    it('should enable "Export everything" radio when there is data', () => {
      render(<AccountManagement groups={mockGroups} peopleCount={5} />);

      const exportAllRadio = screen.getByRole('radio', { name: /export everything/i });
      expect(exportAllRadio).not.toBeDisabled();
    });

    it('should enable "Export specific groups" radio when groups exist', () => {
      render(<AccountManagement groups={mockGroups} peopleCount={0} />);

      const exportGroupsRadio = screen.getByRole('radio', { name: /export specific groups/i });
      expect(exportGroupsRadio).not.toBeDisabled();
    });

    it('should not show "no data" message when there is data', () => {
      render(<AccountManagement groups={mockGroups} peopleCount={5} />);

      expect(screen.queryByText(/no data to export/i)).not.toBeInTheDocument();
    });
  });

  describe('Export functionality', () => {
    it('should call export API when clicking export button with data', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ people: [], groups: [] }),
        })
      ) as unknown as typeof fetch;
      global.fetch = mockFetch;

      const user = userEvent.setup();
      render(<AccountManagement groups={mockGroups} peopleCount={10} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      await user.click(exportJsonButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/export');
      });
    });

    it('should disable button while exporting', async () => {
      const mockFetch = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ people: [], groups: [] }),
                }),
              100
            )
          )
      ) as unknown as typeof fetch;
      global.fetch = mockFetch;

      const user = userEvent.setup();
      render(<AccountManagement groups={mockGroups} peopleCount={10} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      await user.click(exportJsonButton);

      expect(screen.getByRole('button', { name: /exporting\.\.\./i })).toBeDisabled();
    });

    it('should not call export API when no data exists', async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      render(<AccountManagement groups={[]} peopleCount={0} />);

      const exportJsonButton = screen.getByRole('button', { name: /export json/i });
      expect(exportJsonButton).toBeDisabled();

      // Try to click (should not trigger anything since it's disabled)
      fireEvent.click(exportJsonButton);

      expect(mockFetch).not.toHaveBeenCalled();
    });

  });
});
