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

  const mockRelationshipTypes = [
    {
      id: 'rel-1',
      label: 'Friend',
      color: '#00FF00',
    },
    {
      id: 'rel-2',
      label: 'Family',
      color: '#0000FF',
    },
  ];

  describe('Redirect behavior', () => {
    it('should redirect to /settings/carddav on successful CardDAV import', async () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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
          relationshipTypes={mockRelationshipTypes}
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

    it('should include globalRelationshipTypeId in API call when selected', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          relationshipTypes={mockRelationshipTypes}
          isFileImport={false}
        />
      );

      // Select contact
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);

      // Select global relationship
      const relSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(relSelect, { target: { value: 'rel-1' } });

      const importButton = screen.getByText(/importSelected/);
      fireEvent.click(importButton);

      await waitFor(() => {
        const callArg = fetchSpy.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(callArg.body as string);
        expect(body.globalRelationshipTypeId).toBe('rel-1');
      });
    });
  });

  describe('Relationship dropdown', () => {
    it('should render global relationship dropdown with None default', () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          relationshipTypes={mockRelationshipTypes}
          isFileImport={false}
        />
      );

      // The global relationship select should be present
      const relSelect = screen.getAllByRole('combobox')[0];
      expect(relSelect).toBeDefined();
      expect((relSelect as HTMLSelectElement).value).toBe('');
    });

    it('should not render relationship dropdown when no relationship types exist', () => {
      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          relationshipTypes={[]}
          isFileImport={false}
        />
      );

      // Should not have any combobox (the group selector uses a text input, not a combobox)
      const comboboxes = screen.queryAllByRole('combobox');
      expect(comboboxes.length).toBe(0);
    });

    it('should detect unsaved changes when global relationship is set', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(
        <ImportContactsList
          pendingImports={mockPendingImports}
          groups={mockGroups}
          relationshipTypes={mockRelationshipTypes}
          isFileImport={false}
        />
      );

      // Select global relationship (creates unsaved change)
      const relSelect = screen.getAllByRole('combobox')[0];
      fireEvent.change(relSelect, { target: { value: 'rel-1' } });

      // Try to cancel
      const cancelButton = screen.getByText(/cancel/);
      fireEvent.click(cancelButton);

      expect(confirmSpy).toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });
});
