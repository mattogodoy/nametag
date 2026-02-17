/**
 * Tests for ImportContactsList component
 * Focus on file import vs CardDAV import redirect behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ImportContactsList from '@/components/ImportContactsList';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ImportContactsList', () => {
  const mockPush = vi.fn();
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      refresh: mockRefresh,
    });

    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          imported: 1,
          skipped: 0,
          errors: 0,
        }),
      } as Response)
    );
  });

  const mockPendingImports = [
    {
      id: 'import-1',
      uid: 'uid-1',
      href: 'href-1',
      vCardData: `BEGIN:VCARD
VERSION:3.0
FN:John Doe
N:Doe;John;;;
END:VCARD`,
      displayName: 'John Doe',
      discoveredAt: new Date(),
    },
  ];

  const mockGroups = [
    {
      id: 'group-1',
      name: 'Friends',
      color: '#FF0000',
    },
  ];

  describe('Redirect behavior', () => {
    it('should redirect to /settings/carddav on successful CardDAV import', async () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={false}
        />
      );

      // Select a contact
      const checkbox = screen.getAllByRole('checkbox')[1]; // First is select all
      fireEvent.click(checkbox);

      // Click import button
      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/settings/carddav')
        );
      });
    });

    it('should redirect to /people on successful file import', async () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={true}
        />
      );

      // Select a contact
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      // Click import button
      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.stringContaining('/people')
        );
      });
    });

    it('should include import results in redirect URL', async () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={true}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        const callArg = mockPush.mock.calls[0][0];
        expect(callArg).toContain('importSuccess=true');
        expect(callArg).toContain('imported=1');
        expect(callArg).toContain('skipped=0');
        expect(callArg).toContain('errors=0');
      });
    });
  });

  describe('Cancel behavior', () => {
    it('should navigate to /settings/carddav when canceling CardDAV import', () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={false}
        />
      );

      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/settings/carddav');
    });

    it('should navigate to /people when canceling file import', () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={true}
        />
      );

      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      expect(mockPush).toHaveBeenCalledWith('/people');
    });

    it('should show confirmation dialog when canceling with unsaved changes', () => {
      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={false}
        />
      );

      // Select a contact (creates unsaved change)
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      // Try to cancel
      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled(); // User clicked "No"

      confirmSpy.mockRestore();
    });

    it('should allow cancel when user confirms with unsaved changes', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={true}
        />
      );

      // Select a contact
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      // Cancel with confirmation
      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/people');

      confirmSpy.mockRestore();
    });
  });

  describe('isFileImport prop defaults', () => {
    it('should default to false when isFileImport is not provided', () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
        />
      );

      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      // Should use default CardDAV behavior
      expect(mockPush).toHaveBeenCalledWith('/settings/carddav');
    });
  });

  describe('Import API call', () => {
    it('should call /api/carddav/import with selected contacts', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={false}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          '/api/carddav/import',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('import-1'),
          })
        );
      });
    });

    it('should include global groups in API call', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          isFileImport={false}
        />
      );

      // Select contact and group
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      // Select group via GroupsSelector (PillSelector)
      const groupInput = screen.getByPlaceholderText('placeholder');
      fireEvent.focus(groupInput);

      await waitFor(() => {
        const groupOption = screen.getByText('Friends');
        fireEvent.click(groupOption);
      });

      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        const callArg = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(callArg.body as string);
        expect(body.globalGroupIds).toEqual(['group-1']);
      });
    });
  });
});
