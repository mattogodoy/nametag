import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PeopleListClient from '../../components/PeopleListClient';
import enMessages from '../../locales/en.json';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => '/people'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock PersonPhoto (avatar) to simplify rendering
vi.mock('@/components/PersonPhoto', () => ({
  default: ({ name }: { name: string }) => <div data-testid="avatar">{name[0]}</div>,
}));

// Mock bulk modals to avoid complex rendering
vi.mock('@/components/BulkDeleteModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="bulk-delete-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/BulkGroupAssignModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="bulk-group-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/BulkRelationshipModal', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="bulk-relationship-modal">
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

type PersonRow = React.ComponentProps<typeof PeopleListClient>['people'][0];

function makePerson(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: 'p-1',
    name: 'Alice',
    middleName: null,
    surname: 'Smith',
    secondLastName: null,
    nickname: null,
    photo: null,
    lastContact: null,
    relationshipToUser: null,
    groups: [],
    relationshipsFrom: [],
    relationshipsTo: [],
    ...overrides,
  };
}

const defaultTranslations: React.ComponentProps<typeof PeopleListClient>['translations'] = {
  surname: 'Last Name',
  nickname: 'Nickname',
  relationshipToUser: 'Relationship',
  groups: 'Groups',
  lastContact: 'Last Contact',
  actions: 'Actions',
  indirect: 'Indirect',
  orphanWarning: 'This person has no relationships',
  showing: 'Showing people',
  page: 'Page',
  of: 'of',
};

const defaultCommonTranslations: React.ComponentProps<typeof PeopleListClient>['commonTranslations'] = {
  name: 'Name',
  edit: 'Edit',
  view: 'View',
  previous: 'Previous',
  next: 'Next',
};

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof PeopleListClient>> = {}
): React.ComponentProps<typeof PeopleListClient> {
  return {
    people: [makePerson()],
    totalCount: 1,
    currentPage: 1,
    totalPages: 1,
    sortBy: 'name',
    order: 'asc',
    groupFilter: '',
    relationshipFilter: '',
    cfFilter: null,
    dateFormat: 'MDY',
    availableGroups: [],
    relationshipTypes: [],
    customFieldTemplates: [],
    translations: defaultTranslations,
    commonTranslations: defaultCommonTranslations,
    ...overrides,
  };
}

describe('PeopleListClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock sessionStorage
    const storage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      storage[key] = val;
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] ?? null);
  });

  describe('Rendering', () => {
    it('renders a list of people', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({ id: 'p-1', name: 'Alice', surname: 'Smith' }),
                makePerson({ id: 'p-2', name: 'Bob', surname: 'Jones' }),
              ],
              totalCount: 2,
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders showing count text', () => {
      render(
        <Wrapper>
          <PeopleListClient {...defaultProps()} />
        </Wrapper>
      );

      expect(screen.getByText('Showing people')).toBeInTheDocument();
    });

    it('renders table column headers', () => {
      render(
        <Wrapper>
          <PeopleListClient {...defaultProps()} />
        </Wrapper>
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Last Name')).toBeInTheDocument();
    });

    it('renders edit and view links for each person', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [makePerson({ id: 'p-1', name: 'Alice', surname: null })],
            })}
          />
        </Wrapper>
      );

      const editLink = screen.getByTitle('Edit');
      expect(editLink).toBeInTheDocument();
      expect(editLink).toHaveAttribute('href', '/people/p-1/edit');

      const viewLink = screen.getByTitle('View');
      expect(viewLink).toBeInTheDocument();
      expect(viewLink).toHaveAttribute('href', '/people/p-1');
    });

    it('renders relationship badge when person has a relationship', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({
                  id: 'p-1',
                  name: 'Alice',
                  relationshipToUser: { label: 'Friend', color: '#10B981' },
                }),
              ],
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText('Friend')).toBeInTheDocument();
    });

    it('renders indirect badge when person has no direct relationship', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({
                  id: 'p-1',
                  name: 'Alice',
                  relationshipToUser: null,
                  // Has at least one relationship to avoid orphan status
                  relationshipsFrom: [{ id: 'r-1' }],
                }),
              ],
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText('Indirect')).toBeInTheDocument();
    });

    it('renders group badges for person', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({
                  id: 'p-1',
                  name: 'Alice',
                  groups: [
                    {
                      groupId: 'g-1',
                      group: { name: 'Family', color: '#EF4444' },
                    },
                  ],
                }),
              ],
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText('Family')).toBeInTheDocument();
    });

    it('shows orphan warning for isolated people', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({
                  id: 'p-1',
                  name: 'Alice',
                  relationshipToUser: null,
                  relationshipsFrom: [],
                  relationshipsTo: [],
                }),
              ],
            })}
          />
        </Wrapper>
      );

      // Orphan warning icon appears (⚠️)
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });
  });

  describe('Group filter', () => {
    it('renders group filter dropdown', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              availableGroups: [
                { id: 'g-1', name: 'Family', color: null },
              ],
            })}
          />
        </Wrapper>
      );

      // Should have "All groups" option (lowercase from i18n)
      expect(screen.getByText('All groups')).toBeInTheDocument();
      expect(screen.getByText('Family')).toBeInTheDocument();
    });

    it('renders relationship type filter dropdown', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              relationshipTypes: [
                { id: 'rt-1', label: 'Friend', color: null },
              ],
            })}
          />
        </Wrapper>
      );

      expect(screen.getByText('All relationships')).toBeInTheDocument();
      expect(screen.getByText('Friend')).toBeInTheDocument();
    });
  });

  describe('Selection / checkboxes', () => {
    it('renders a checkbox for each person', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({ id: 'p-1', name: 'Alice', surname: null }),
                makePerson({ id: 'p-2', name: 'Bob', surname: null }),
              ],
              totalCount: 2,
            })}
          />
        </Wrapper>
      );

      // Header checkbox + 2 person checkboxes = 3 total
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(3);
    });

    it('renders a select-all header checkbox', () => {
      render(
        <Wrapper>
          <PeopleListClient {...defaultProps()} />
        </Wrapper>
      );

      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      expect(headerCheckbox).toHaveAttribute('title', 'Select all');
    });

    it('selects a person when their checkbox is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [makePerson({ id: 'p-1', name: 'Alice', surname: null })],
            })}
          />
        </Wrapper>
      );

      const personCheckbox = screen.getAllByRole('checkbox')[1]; // [0] is header
      expect(personCheckbox).not.toBeChecked();

      await user.click(personCheckbox);

      expect(personCheckbox).toBeChecked();
    });

    it('selects all people on page when header checkbox is clicked', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({ id: 'p-1', name: 'Alice', surname: null }),
                makePerson({ id: 'p-2', name: 'Bob', surname: null }),
              ],
              totalCount: 2,
            })}
          />
        </Wrapper>
      );

      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(headerCheckbox);

      const allCheckboxes = screen.getAllByRole('checkbox');
      // All person checkboxes should be checked
      expect(allCheckboxes[1]).toBeChecked();
      expect(allCheckboxes[2]).toBeChecked();
    });

    it('shows floating action bar when items are selected', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [makePerson({ id: 'p-1', name: 'Alice', surname: null })],
            })}
          />
        </Wrapper>
      );

      const personCheckbox = screen.getAllByRole('checkbox')[1];
      await user.click(personCheckbox);

      // Action bar should show "1 selected"
      expect(screen.getByText('1 selected')).toBeInTheDocument();
    });

    it('hides floating action bar when selection is cleared', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [makePerson({ id: 'p-1', name: 'Alice', surname: null })],
            })}
          />
        </Wrapper>
      );

      const personCheckbox = screen.getAllByRole('checkbox')[1];
      await user.click(personCheckbox);

      // Action bar should show "1 selected"
      expect(screen.getByText('1 selected')).toBeInTheDocument();

      // Click X to clear selection
      const clearButton = screen.getByTitle('Clear selection');
      await user.click(clearButton);

      // The text "1 selected" should no longer be visible
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });
  });

  describe('Bulk action buttons', () => {
    async function selectOneAndGetActionBar() {
      const user = userEvent.setup();
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [makePerson({ id: 'p-1', name: 'Alice', surname: null })],
              availableGroups: [{ id: 'g-1', name: 'Family', color: null }],
              relationshipTypes: [{ id: 'rt-1', label: 'Friend', color: null }],
            })}
          />
        </Wrapper>
      );

      const personCheckbox = screen.getAllByRole('checkbox')[1];
      await user.click(personCheckbox);

      return user;
    }

    it('shows Add to Groups button in action bar', async () => {
      await selectOneAndGetActionBar();
      expect(screen.getByRole('button', { name: /add to groups/i })).toBeInTheDocument();
    });

    it('shows Set Relationship button in action bar', async () => {
      await selectOneAndGetActionBar();
      expect(screen.getByRole('button', { name: /set relationship/i })).toBeInTheDocument();
    });

    it('shows Delete button in action bar', async () => {
      await selectOneAndGetActionBar();
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
    });

    it('opens bulk delete modal when Delete is clicked', async () => {
      const user = await selectOneAndGetActionBar();

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(screen.getByTestId('bulk-delete-modal')).toBeInTheDocument();
    });

    it('opens bulk group modal when Add to Groups is clicked', async () => {
      const user = await selectOneAndGetActionBar();

      await user.click(screen.getByRole('button', { name: /add to groups/i }));

      expect(screen.getByTestId('bulk-group-modal')).toBeInTheDocument();
    });

    it('opens bulk relationship modal when Set Relationship is clicked', async () => {
      const user = await selectOneAndGetActionBar();

      await user.click(screen.getByRole('button', { name: /set relationship/i }));

      expect(screen.getByTestId('bulk-relationship-modal')).toBeInTheDocument();
    });
  });

  describe('Sort headers', () => {
    it('shows sort indicator for currently sorted column', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({ sortBy: 'name', order: 'asc' })}
          />
        </Wrapper>
      );

      // Ascending arrow ↑ should appear next to Name
      expect(screen.getByText('↑')).toBeInTheDocument();
    });

    it('shows descending indicator when order is desc', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({ sortBy: 'name', order: 'desc' })}
          />
        </Wrapper>
      );

      expect(screen.getByText('↓')).toBeInTheDocument();
    });

    it('renders sort links for table headers', () => {
      render(
        <Wrapper>
          <PeopleListClient {...defaultProps()} />
        </Wrapper>
      );

      // Name header should be a link
      const nameLink = screen.getByRole('link', { name: /^name/i });
      expect(nameLink).toHaveAttribute('href', expect.stringContaining('sortBy=name'));
    });
  });

  describe('Pagination', () => {
    it('does not show pagination when there is only one page', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({ totalPages: 1, currentPage: 1 })}
          />
        </Wrapper>
      );

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    });

    it('shows pagination when there are multiple pages', () => {
      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({ totalPages: 3, currentPage: 2 })}
          />
        </Wrapper>
      );

      // Pagination nav should be present in the DOM (even if visually hidden on small screens)
      const nav = document.querySelector('nav');
      expect(nav).toBeInTheDocument();

      // Page numbers should be rendered
      const pageLinks = document.querySelectorAll('nav a, nav span');
      expect(pageLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Select all pages banner', () => {
    it('shows select all pages button when all current page items are selected and more pages exist', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <PeopleListClient
            {...defaultProps({
              people: [
                makePerson({ id: 'p-1', name: 'Alice', surname: null }),
              ],
              totalCount: 50,
              totalPages: 5,
              currentPage: 1,
            })}
          />
        </Wrapper>
      );

      // Select all on this page via header checkbox
      const headerCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(headerCheckbox);

      // Should show "Select all 50 people" button
      expect(screen.getByText(/select all 50 people/i)).toBeInTheDocument();
    });
  });
});
