import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import GroupForm from '../../components/GroupForm';
import { PRESET_COLORS } from '../../lib/colors';
import enMessages from '../../locales/en.json';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('GroupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 'group-1', name: 'Test Group' }),
      } as Response)
    );
  });

  describe('Create mode', () => {
    it('renders empty form in create mode', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/group name/i)).toHaveValue('');
      expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    });

    it('shows cancel and create buttons', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      expect(screen.getByRole('link', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    });

    it('does not show people selector when no people are provided', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" availablePeople={[]} />
        </Wrapper>
      );

      expect(screen.queryByText(/add people/i)).not.toBeInTheDocument();
    });

    it('shows people selector when available people are provided', () => {
      const availablePeople = [
        { id: 'p-1', name: 'Alice', surname: 'Smith', nickname: null },
      ];

      render(
        <Wrapper>
          <GroupForm mode="create" availablePeople={availablePeople} />
        </Wrapper>
      );

      expect(screen.getAllByText(/add people/i).length).toBeGreaterThan(0);
    });
  });

  describe('Edit mode', () => {
    const existingGroup = {
      id: 'group-1',
      name: 'Family',
      description: 'Close family members',
      color: '#10B981',
    };

    it('renders form pre-filled with existing group data', () => {
      render(
        <Wrapper>
          <GroupForm mode="edit" group={existingGroup} />
        </Wrapper>
      );

      expect(screen.getByLabelText(/group name/i)).toHaveValue('Family');
      expect(screen.getByDisplayValue('Close family members')).toBeInTheDocument();
    });

    it('shows update button in edit mode', () => {
      render(
        <Wrapper>
          <GroupForm mode="edit" group={existingGroup} />
        </Wrapper>
      );

      expect(screen.getByRole('button', { name: /update group/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create group/i })).not.toBeInTheDocument();
    });

    it('does not show people selector in edit mode even if people are provided', () => {
      const availablePeople = [
        { id: 'p-1', name: 'Alice', surname: null, nickname: null },
      ];

      render(
        <Wrapper>
          <GroupForm mode="edit" group={existingGroup} availablePeople={availablePeople} />
        </Wrapper>
      );

      expect(screen.queryByText(/add people/i)).not.toBeInTheDocument();
    });
  });

  describe('Name field validation', () => {
    it('name field is required', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      const nameInput = screen.getByLabelText(/group name/i);
      expect(nameInput).toHaveAttribute('required');
    });
  });

  describe('Color picker', () => {
    it('renders preset color buttons', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      // There should be x preset color buttons
      const colorButtons = screen.getAllByRole('button').filter(
        (btn) => btn.getAttribute('type') === 'button' && btn.style.backgroundColor
      );
      expect(colorButtons.length).toBe(PRESET_COLORS.length);
    });

    it('selecting a preset color updates the custom color input', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      const redColorButton = screen.getByTitle(PRESET_COLORS[0]);
      await user.click(redColorButton);

      const colorInput = screen.getByLabelText(/or choose a custom color/i) as HTMLInputElement;
      expect(colorInput.value).toBe('#ef4444');
    });

    it('renders custom color input', () => {
      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      expect(screen.getByLabelText(/or choose a custom color/i)).toBeInTheDocument();
    });

    it('reroll updates the selected color', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      const colorInput = screen.getByLabelText(/or choose a custom color/i) as HTMLInputElement;

      await user.click(screen.getByRole('button', { name: /Generate a random color/i }));

      expect(colorInput.value).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('Form submission', () => {
    it('calls POST /api/groups when creating a group', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      await user.type(screen.getByLabelText(/group name/i), 'My New Group');
      await user.click(screen.getByRole('button', { name: /create group/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/groups',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('calls PUT /api/groups/:id when editing a group', async () => {
      const user = userEvent.setup();
      const existingGroup = {
        id: 'group-42',
        name: 'Old Name',
        description: null,
        color: null,
      };

      render(
        <Wrapper>
          <GroupForm mode="edit" group={existingGroup} />
        </Wrapper>
      );

      await user.click(screen.getByRole('button', { name: /update group/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/groups/group-42',
          expect.objectContaining({ method: 'PUT' })
        );
      });
    });

    it('includes name, description, and color in the request body', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      await user.type(screen.getByLabelText(/group name/i), 'Friends');
      await user.type(screen.getByPlaceholderText(/optional description/i), 'My friends');
      await user.click(screen.getByRole('button', { name: /create group/i }));

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
        );
        expect(callBody.name).toBe('Friends');
        expect(callBody.description).toBe('My friends');
        expect(callBody.color).toBeTruthy();
      });
    });

    it('shows saving state while submitting', async () => {
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ id: 'group-1' }),
                } as Response),
              100
            )
          )
      ) as unknown as typeof global.fetch;

      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      await user.type(screen.getByLabelText(/group name/i), 'Test');
      await user.click(screen.getByRole('button', { name: /create group/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });
    });

    it('shows error message when API returns an error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'Name already taken' }),
        } as Response)
      );

      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      await user.type(screen.getByLabelText(/group name/i), 'Existing Group');
      await user.click(screen.getByRole('button', { name: /create group/i }));

      await waitFor(() => {
        expect(screen.getByText(/name already taken/i)).toBeInTheDocument();
      });
    });

    it('shows connection error when fetch throws', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const user = userEvent.setup();

      render(
        <Wrapper>
          <GroupForm mode="create" />
        </Wrapper>
      );

      await user.type(screen.getByLabelText(/group name/i), 'Test Group');
      await user.click(screen.getByRole('button', { name: /create group/i }));

      await waitFor(() => {
        expect(screen.getByText(/unable to connect to server/i)).toBeInTheDocument();
      });
    });
  });
});
