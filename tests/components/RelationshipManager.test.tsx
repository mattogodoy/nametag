import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Mock PersonAutocomplete to avoid rendering complexity
vi.mock('../../components/PersonAutocomplete', () => ({
  default: () => <div data-testid="person-autocomplete" />,
}));

// Wrapper component with NextIntlClientProvider for rich text rendering
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

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
});
