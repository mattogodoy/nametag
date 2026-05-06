import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PersonActionsMenu from '../../components/PersonActionsMenu';
import enMessages from '../../locales/en.json';
import type { PersonWithRelations } from '../../lib/carddav/types';

// Mock heavy external libs
vi.mock('@/lib/carddav/vcard-export', () => ({
  personToVCard: vi.fn(() => 'BEGIN:VCARD\nEND:VCARD'),
}));

vi.mock('@/lib/vcard-client-utils', () => ({
  addPhotoToVCardFromUrl: vi.fn(async (vcard: string) => vcard),
  downloadVcf: vi.fn(),
  generateVcfFilename: vi.fn(() => 'contact.vcf'),
}));

vi.mock('@/lib/photo-url', () => ({
  getPhotoUrl: vi.fn(() => null),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <svg data-testid="qr-code" />,
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

const mockPerson: PersonWithRelations = {
  id: 'person-1',
  userId: 'user-1',
  name: 'John',
  surname: 'Doe',
  middleName: null,
  secondLastName: null,
  nickname: null,
  prefix: null,
  suffix: null,
  photo: null,
  organization: null,
  jobTitle: null,
  gender: null,
  anniversary: null,
  lastContact: null,
  notes: null,
  uid: null,
  relationshipToUserId: null,
  deletedAt: null,
  contactReminderEnabled: false,
  contactReminderInterval: null,
  contactReminderIntervalUnit: null,
  lastContactReminderSent: null,
  cardDavSyncEnabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  phoneNumbers: [],
  emails: [],
  addresses: [],
  urls: [],
  imHandles: [],
  locations: [],
  customFields: [],
  customFieldValues: [],
  importantDates: [],
  relationshipsFrom: [],
  groups: [],
};

function renderMenu(props: Partial<React.ComponentProps<typeof PersonActionsMenu>> = {}) {
  return render(
    <Wrapper>
      <PersonActionsMenu
        personId="person-1"
        personName="John Doe"
        person={mockPerson}
        hasCardDavSync={false}
        {...props}
      />
    </Wrapper>
  );
}

describe('PersonActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ orphans: [] }),
      } as Response)
    );
  });

  describe('Menu trigger', () => {
    it('renders an actions button', () => {
      renderMenu();
      expect(screen.getByRole('button', { name: /actions/i })).toBeInTheDocument();
    });

    it('menu is closed by default', () => {
      renderMenu();
      expect(screen.queryByText(/find duplicates/i)).not.toBeInTheDocument();
    });

    it('opens menu when trigger is clicked', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/find duplicates/i)).toBeInTheDocument();
    });

    it('closes menu when trigger is clicked again', async () => {
      const user = userEvent.setup();
      renderMenu();

      const trigger = screen.getByRole('button', { name: /actions/i });
      await user.click(trigger);
      await user.click(trigger);

      expect(screen.queryByText(/find duplicates/i)).not.toBeInTheDocument();
    });
  });

  describe('Menu items', () => {
    it('shows find duplicates option', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/find duplicates/i)).toBeInTheDocument();
    });

    it('shows merge with option', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/merge with/i)).toBeInTheDocument();
    });

    it('shows download vCard file option', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/download vcard file/i)).toBeInTheDocument();
    });

    it('shows show contact QR option', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/show contact qr/i)).toBeInTheDocument();
    });

    it('shows delete option', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));

      expect(screen.getByText(/^delete$/i)).toBeInTheDocument();
    });
  });

  describe('Delete action', () => {
    it('opens delete confirmation dialog', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/^delete$/i));

      await waitFor(() => {
        expect(screen.getByText(/delete person/i)).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete John Doe/i)).toBeInTheDocument();
      });
    });

    it('closes menu when delete is clicked', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/^delete$/i));

      // Menu items should no longer be visible (menu closed)
      await waitFor(() => {
        expect(screen.queryByText(/download vcard file/i)).not.toBeInTheDocument();
      });
    });

    it('shows CardDAV delete option when hasCardDavSync is true', async () => {
      const user = userEvent.setup();
      renderMenu({ hasCardDavSync: true });

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/^delete$/i));

      await waitFor(() => {
        expect(screen.getByText(/also delete from carddav server/i)).toBeInTheDocument();
      });
    });

    it('does not show CardDAV delete option when hasCardDavSync is false', async () => {
      const user = userEvent.setup();
      renderMenu({ hasCardDavSync: false });

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/^delete$/i));

      await waitFor(() => {
        expect(screen.queryByText(/also delete from carddav server/i)).not.toBeInTheDocument();
      });
    });

    it('calls DELETE API when confirmed', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ orphans: [] }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);

      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/^delete$/i));

      await waitFor(() => {
        expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getAllByRole('button', { name: /^delete$/i }).find(
        (btn) => btn.closest('[role="dialog"]') || btn.closest('.fixed')
      );

      if (confirmBtn) {
        await user.click(confirmBtn);

        await waitFor(() => {
          const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
          const deleteCall = calls.find(
            (call) => call[1]?.method === 'DELETE'
          );
          expect(deleteCall).toBeDefined();
          expect(deleteCall?.[0]).toContain('/api/people/person-1');
        });
      }
    });
  });

  describe('QR code action', () => {
    it('opens QR code modal when show contact QR is clicked', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/show contact qr/i));

      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
        expect(screen.getByText(/contact qr code/i)).toBeInTheDocument();
      });
    });

    it('closes QR modal when close button is clicked', async () => {
      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/show contact qr/i));

      await waitFor(() => {
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^close$/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
      });
    });
  });

  describe('Merge action', () => {
    it('opens merge modal when merge with is clicked', async () => {
      const user = userEvent.setup();
      renderMenu({ allPeople: [] });

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/merge with/i));

      await waitFor(() => {
        expect(screen.getByText(/merge with\.\.\./i)).toBeInTheDocument();
      });
    });
  });

  describe('Find duplicates action', () => {
    it('shows loading state while fetching duplicates', async () => {
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ duplicates: [] }),
                } as Response),
              200
            )
          )
      ) as unknown as typeof global.fetch;

      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/find duplicates/i));

      // Should show a spinner (loading state)
      // The component renders a div with animate-spin
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('shows no duplicates message when none are found', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ duplicates: [] }),
        } as Response)
      );

      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/find duplicates/i));

      await waitFor(() => {
        expect(screen.getByText(/no duplicate contacts found/i)).toBeInTheDocument();
      });
    });

    it('shows duplicate candidates when found', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              duplicates: [
                {
                  personId: 'person-2',
                  name: 'Jane',
                  surname: 'Doe',
                  similarity: 0.85,
                },
              ],
            }),
        } as Response)
      );

      const user = userEvent.setup();
      renderMenu();

      await user.click(screen.getByRole('button', { name: /actions/i }));
      await user.click(screen.getByText(/find duplicates/i));

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText(/85% match/i)).toBeInTheDocument();
      });
    });
  });
});
