import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupsSelector from '../../components/GroupsSelector';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from 'sonner';

describe('GroupsSelector', () => {
  const mockGroups = [
    { id: 'group-1', name: 'Family', color: '#FF0000' },
    { id: 'group-2', name: 'Friends', color: '#00FF00' },
    { id: 'group-3', name: 'Work', color: '#0000FF' },
  ];

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('Basic functionality', () => {
    it('should render with placeholder text', () => {
      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
        />
      );

      expect(screen.getByPlaceholderText(/search groups/i)).toBeInTheDocument();
    });

    it('should show available groups when focused', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText(/search groups/i);
      await user.click(input);

      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.getByText('Friends')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('should filter groups based on search term', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText(/search groups/i);
      await user.type(input, 'Fam');

      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.queryByText('Friends')).not.toBeInTheDocument();
      expect(screen.queryByText('Work')).not.toBeInTheDocument();
    });

    it('should add group when clicking on suggestion', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText(/search groups/i);
      await user.click(input);
      await user.click(screen.getByText('Family'));

      expect(mockOnChange).toHaveBeenCalledWith(['group-1']);
    });

    it('should remove group when clicking X on pill', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={['group-1']}
          onChange={mockOnChange}
        />
      );

      const removeButton = screen.getByLabelText('Remove Family');
      await user.click(removeButton);

      expect(mockOnChange).toHaveBeenCalledWith([]);
    });
  });

  describe('On-the-fly group creation', () => {
    it('should show "Create group" option when typing a new group name', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');

      expect(screen.getByText(/Create group/i)).toBeInTheDocument();
      expect(screen.getByText(/"New Group"/)).toBeInTheDocument();
    });

    it('should not show "Create group" option when search matches existing group exactly', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'Family');

      // Should show Family in suggestions but not Create option
      expect(screen.getByText('Family')).toBeInTheDocument();
      expect(screen.queryByText(/Create group/i)).not.toBeInTheDocument();
    });

    it('should not show "Create group" option when allowCreate is false', async () => {
      const user = userEvent.setup();

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={false}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');

      expect(screen.queryByText(/Create group/i)).not.toBeInTheDocument();
    });

    it('should create group via API when clicking "Create group" option', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('New Group'),
        });
      });
    });

    it('should auto-select the newly created group', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(['new-group-id']);
      });
    });

    it('should show success toast after creating group', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Group "New Group" created');
      });
    });

    it('should show error toast when group creation fails', async () => {
      const user = userEvent.setup();

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'A group with this name already exists' }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'Existing Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('A group with this name already exists');
      });
    });

    it('should create group with a random color', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        // Check that color is a valid hex color
        expect(body.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });

    it('should create group when pressing Enter on "Create group" option', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'New Group');
      // Press down arrow to navigate to "Create group" option (it's the only option since no match)
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/groups', expect.any(Object));
      });
    });

    it('should clear input after creating group', async () => {
      const user = userEvent.setup();
      const newGroup = { id: 'new-group-id', name: 'New Group', color: '#123456' };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ group: newGroup }),
      });

      render(
        <GroupsSelector
          availableGroups={mockGroups}
          selectedGroupIds={[]}
          onChange={mockOnChange}
          allowCreate={true}
        />
      );

      const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
      await user.type(input, 'New Group');
      await user.click(screen.getByText(/Create group/i));

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });
});
