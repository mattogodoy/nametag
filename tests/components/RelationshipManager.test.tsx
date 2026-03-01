import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import RelationshipManager from '../../components/RelationshipManager';
import enMessages from '../../locales/en.json';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Store the onChange callback so tests can simulate person selection
let capturedOnChange: ((personId: string, personName: string) => void) | null = null;

// Mock PersonAutocomplete to capture onChange and allow tests to trigger it
vi.mock('../../components/PersonAutocomplete', () => ({
  default: ({ onChange }: { onChange: (personId: string, personName: string) => void }) => {
    capturedOnChange = onChange;
    return <div data-testid="person-autocomplete" />;
  },
}));

// Wrapper component with NextIntlClientProvider for rich text rendering
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  capturedOnChange = null;
});

describe('RelationshipManager', () => {
  const defaultProps = {
    personId: 'person-alice',
    personName: 'Alice',
    relationships: [
      {
        id: 'rel-1',
        personId: 'person-john',
        relationshipTypeId: 'type-parent',
        notes: null,
        person: {
          id: 'person-john',
          name: 'John',
          surname: 'Doe',
          nickname: null,
        },
        relationshipType: {
          id: 'type-parent',
          name: 'PARENT',
          label: 'Parent',
          color: '#FF5733',
          inverseId: 'type-child',
        },
      },
    ],
    availablePeople: [],
    relationshipTypes: [
      {
        id: 'type-parent',
        name: 'PARENT',
        label: 'Parent',
        color: '#FF5733',
        inverseId: 'type-child',
      },
      {
        id: 'type-child',
        name: 'CHILD',
        label: 'Child',
        color: '#33FF57',
        inverseId: 'type-parent',
      },
    ],
  };

  it('should render the relationship sentence format with rich text', () => {
    render(
      <Wrapper>
        <RelationshipManager {...defaultProps} />
      </Wrapper>
    );

    // Verify the sentence components are rendered:
    // "John Doe is Alice's Parent"
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Parent')).toBeInTheDocument();

    // Verify "is Alice's" appears as part of the rendered text
    // The rich text renders: <name>John Doe</name> is Alice's <type>Parent</type>
    // so "is Alice's" is a text node between the tags
    const container = screen.getByText('John Doe').closest('.flex.items-center');
    expect(container).not.toBeNull();
    expect(container!.textContent).toContain("is Alice's");
  });

  it('should render "John Doe" as a link to the correct person page', () => {
    render(
      <Wrapper>
        <RelationshipManager {...defaultProps} />
      </Wrapper>
    );

    const link = screen.getByText('John Doe');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/people/person-john');
  });

  it('should show the empty state when there are no relationships', () => {
    render(
      <Wrapper>
        <RelationshipManager
          {...defaultProps}
          relationships={[]}
        />
      </Wrapper>
    );

    expect(screen.getByText('No relationships yet.')).toBeInTheDocument();
  });

  it('should render multiple relationships', () => {
    const propsWithMultiple = {
      ...defaultProps,
      relationships: [
        ...defaultProps.relationships,
        {
          id: 'rel-2',
          personId: 'person-jane',
          relationshipTypeId: 'type-child',
          notes: 'Close friend of the family',
          person: {
            id: 'person-jane',
            name: 'Jane',
            surname: 'Smith',
            nickname: null,
          },
          relationshipType: {
            id: 'type-child',
            name: 'CHILD',
            label: 'Child',
            color: '#33FF57',
            inverseId: 'type-parent',
          },
        },
      ],
    };

    render(
      <Wrapper>
        <RelationshipManager {...propsWithMultiple} />
      </Wrapper>
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Child')).toBeInTheDocument();
    // Verify notes are rendered
    expect(screen.getByText('Close friend of the family')).toBeInTheDocument();
  });

  it('should apply the relationship type color to the badge', () => {
    render(
      <Wrapper>
        <RelationshipManager {...defaultProps} />
      </Wrapper>
    );

    const badge = screen.getByText('Parent');
    // The component applies color as inline style
    expect(badge).toHaveStyle({ color: '#FF5733' });
  });

  describe('Add Modal Preview', () => {
    const propsWithAvailablePeople = {
      ...defaultProps,
      availablePeople: [
        {
          id: 'person-bob',
          name: 'Bob',
          surname: 'Brown',
          nickname: null,
        },
      ],
    };

    it('should not show preview when no person is selected', () => {
      render(
        <Wrapper>
          <RelationshipManager {...propsWithAvailablePeople} />
        </Wrapper>
      );

      // Open the add modal
      fireEvent.click(screen.getByText('Add Relationship'));

      // Preview should not be visible when no person is selected
      expect(screen.queryByTestId('relationship-preview')).not.toBeInTheDocument();
    });

    it('should show preview with person name when person is selected', () => {
      render(
        <Wrapper>
          <RelationshipManager {...propsWithAvailablePeople} />
        </Wrapper>
      );

      // Open the add modal
      fireEvent.click(screen.getByText('Add Relationship'));

      // Simulate selecting a person through the autocomplete
      act(() => {
        if (capturedOnChange) {
          capturedOnChange('person-bob', 'Bob Brown');
        }
      });

      const preview = screen.getByTestId('relationship-preview');
      // Preview: "Bob Brown is Alice's Parent"
      expect(preview.textContent).toContain('Bob Brown');
      expect(preview.textContent).toContain("Alice's");
      expect(preview.textContent).toContain('Parent');
    });

    it('should update preview when relationship type changes', () => {
      render(
        <Wrapper>
          <RelationshipManager {...propsWithAvailablePeople} />
        </Wrapper>
      );

      // Open the add modal
      fireEvent.click(screen.getByText('Add Relationship'));

      // Simulate selecting a person
      act(() => {
        if (capturedOnChange) {
          capturedOnChange('person-bob', 'Bob Brown');
        }
      });

      // Change relationship type to Child
      const typeSelect = screen.getByDisplayValue('Parent');
      fireEvent.change(typeSelect, { target: { value: 'type-child' } });

      const preview = screen.getByTestId('relationship-preview');
      // Preview: "Bob Brown is Alice's Child"
      expect(preview.textContent).toContain('Bob Brown');
      expect(preview.textContent).toContain("Alice's");
      expect(preview.textContent).toContain('Child');
    });

    it('should show "your" variant when currentUser is selected', () => {
      const propsWithCurrentUser = {
        ...propsWithAvailablePeople,
        currentUser: {
          id: 'user-1',
          name: 'Me',
          surname: 'User',
          nickname: null,
        },
        hasUserRelationship: false,
      };

      render(
        <Wrapper>
          <RelationshipManager {...propsWithCurrentUser} />
        </Wrapper>
      );

      // Open the add modal
      fireEvent.click(screen.getByText('Add Relationship'));

      // Simulate selecting the current user
      act(() => {
        if (capturedOnChange) {
          capturedOnChange('user-1', 'Me User');
        }
      });

      const preview = screen.getByTestId('relationship-preview');
      // Preview: "Me User is your Parent"
      expect(preview.textContent).toContain('Me User');
      expect(preview.textContent).toContain('your');
      expect(preview.textContent).toContain('Parent');
      // Should NOT contain Alice's since it's the "your" variant
      expect(preview.textContent).not.toContain("Alice's");
    });
  });
});
