import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PersonForm from '../../components/PersonForm';
import enMessages from '../../locales/en.json';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock sonner toast
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

const defaultProps = {
  groups: [],
  relationshipTypes: [
    { id: 'rt-1', label: 'Friend', color: null },
  ],
  mode: 'create' as const,
  dateFormat: 'MDY' as const,
};

const editPerson = {
  id: 'person-1',
  name: 'John',
  surname: 'Doe',
  middleName: null,
  secondLastName: null,
  nickname: null,
  prefix: null,
  suffix: null,
  organization: null,
  jobTitle: null,
  lastContact: null,
  notes: null,
  relationshipToUserId: 'rt-1',
  relationshipToUser: { label: 'Friend' },
  groups: [],
  contactReminderEnabled: false,
  contactReminderInterval: null,
  contactReminderIntervalUnit: null,
  cardDavSyncEnabled: true,
  cardDavMapping: null,
};

describe('PersonForm CardDAV Sync Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not show toggle when hasCardDavConnection is false', () => {
    render(
      <Wrapper>
        <PersonForm {...defaultProps} hasCardDavConnection={false} />
      </Wrapper>
    );

    expect(screen.queryByText('CardDAV Sync')).not.toBeInTheDocument();
    expect(screen.queryByText('Sync to CardDAV server')).not.toBeInTheDocument();
  });

  it('should not show toggle when hasCardDavConnection is undefined', () => {
    render(
      <Wrapper>
        <PersonForm {...defaultProps} />
      </Wrapper>
    );

    expect(screen.queryByText('CardDAV Sync')).not.toBeInTheDocument();
  });

  it('should show toggle when hasCardDavConnection is true', () => {
    render(
      <Wrapper>
        <PersonForm {...defaultProps} hasCardDavConnection={true} />
      </Wrapper>
    );

    expect(screen.getByText('CardDAV Sync')).toBeInTheDocument();
    expect(screen.getByText('Sync to CardDAV server')).toBeInTheDocument();
  });

  it('should default toggle to enabled for new person', () => {
    render(
      <Wrapper>
        <PersonForm {...defaultProps} hasCardDavConnection={true} />
      </Wrapper>
    );

    const toggle = screen.getByRole('button', { name: '' });
    // The toggle button with bg-primary class means it's enabled
    const toggleButtons = screen.getAllByRole('button');
    const cardDavToggle = toggleButtons.find(btn => btn.id === 'carddav-sync-toggle');
    expect(cardDavToggle).toBeDefined();
    expect(cardDavToggle?.className).toContain('bg-primary');
  });

  it('should show warning when disabling sync for a person with cardDavMapping', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <PersonForm
          {...defaultProps}
          mode="edit"
          hasCardDavConnection={true}
          person={{
            ...editPerson,
            cardDavSyncEnabled: true,
            cardDavMapping: { id: 'mapping-1' },
          }}
        />
      </Wrapper>
    );

    // Click the toggle to disable
    const toggleButtons = screen.getAllByRole('button');
    const cardDavToggle = toggleButtons.find(btn => btn.id === 'carddav-sync-toggle');
    expect(cardDavToggle).toBeDefined();
    await user.click(cardDavToggle!);

    // Warning should now be visible
    expect(screen.getByText(/immediately deleted from your CardDAV server/)).toBeInTheDocument();
  });

  it('should not show warning when disabling sync for a person without cardDavMapping', async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <PersonForm
          {...defaultProps}
          mode="edit"
          hasCardDavConnection={true}
          person={{
            ...editPerson,
            cardDavSyncEnabled: true,
            cardDavMapping: null,
          }}
        />
      </Wrapper>
    );

    // Click the toggle to disable
    const toggleButtons = screen.getAllByRole('button');
    const cardDavToggle = toggleButtons.find(btn => btn.id === 'carddav-sync-toggle');
    expect(cardDavToggle).toBeDefined();
    await user.click(cardDavToggle!);

    // Warning should not be visible
    expect(screen.queryByText(/immediately deleted from your CardDAV server/)).not.toBeInTheDocument();
  });
});
