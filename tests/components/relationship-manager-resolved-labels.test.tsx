import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import RelationshipManager from '../../components/RelationshipManager';
import UserRelationshipCard from '../../components/UserRelationshipCard';
import enMessages from '../../locales/en.json';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SearchIndexProvider
vi.mock('../../components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
}));

// Mock PersonAutocomplete: not exercised by these tests, but RelationshipManager
// renders it inside the Add modal markup regardless.
vi.mock('../../components/PersonAutocomplete', () => ({
  default: () => <div data-testid="person-autocomplete" />,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RelationshipManager resolved labels', () => {
  const baseProps = {
    personId: 'person-alice',
    personName: 'Alice',
    relationships: [
      {
        id: 'rel-1',
        personId: 'person-john',
        relationshipTypeId: 'type-sibling',
        notes: null,
        person: {
          id: 'person-john',
          name: 'John',
          surname: 'Doe',
          nickname: null,
        },
        relationshipType: {
          id: 'type-sibling',
          name: 'SIBLING',
          label: 'Sibling',
          color: '#FF5733',
          inverseId: null,
        },
      },
    ],
    availablePeople: [],
    relationshipTypes: [
      {
        id: 'type-sibling',
        name: 'SIBLING',
        label: 'Sibling',
        color: '#FF5733',
        inverseId: null,
      },
    ],
  };

  it('renders relationshipType.label when resolvedLabel is absent, preserving today\'s behaviour', () => {
    render(
      <Wrapper>
        <RelationshipManager {...baseProps} />
      </Wrapper>
    );

    expect(screen.getByText('Sibling')).toBeInTheDocument();
    expect(screen.queryByText('Frère')).not.toBeInTheDocument();
  });

  it('renders resolvedLabel when present', () => {
    const propsWithResolvedLabel = {
      ...baseProps,
      relationships: [
        {
          ...baseProps.relationships[0],
          resolvedLabel: 'Frère',
        },
      ],
    };

    render(
      <Wrapper>
        <RelationshipManager {...propsWithResolvedLabel} />
      </Wrapper>
    );

    expect(screen.getByText('Frère')).toBeInTheDocument();
    expect(screen.queryByText('Sibling')).not.toBeInTheDocument();
  });

  it('exposes the type name as the title attribute on the label chip', () => {
    const propsWithResolvedLabel = {
      ...baseProps,
      relationships: [
        {
          ...baseProps.relationships[0],
          resolvedLabel: 'Frère',
        },
      ],
    };

    render(
      <Wrapper>
        <RelationshipManager {...propsWithResolvedLabel} />
      </Wrapper>
    );

    const chip = screen.getByText('Frère');
    expect(chip).toHaveAttribute('title', 'Sibling');
  });
});

describe('UserRelationshipCard resolved labels', () => {
  const baseProps = {
    personId: 'person-alice',
    personName: 'Alice',
    relationshipToUser: {
      id: 'type-parent',
      label: 'Parent',
      color: '#FF5733',
    },
    relationshipTypes: [
      {
        id: 'type-parent',
        name: 'PARENT',
        label: 'Parent',
        color: '#FF5733',
        inverseId: null,
      },
    ],
  };

  it('renders relationshipToUser.label when resolvedLabel is absent, preserving today\'s behaviour', () => {
    render(
      <Wrapper>
        <UserRelationshipCard {...baseProps} />
      </Wrapper>
    );

    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.queryByText('Père')).not.toBeInTheDocument();
  });

  it('renders resolvedLabel when present', () => {
    render(
      <Wrapper>
        <UserRelationshipCard {...baseProps} resolvedLabel="Père" />
      </Wrapper>
    );

    expect(screen.getByText('Père')).toBeInTheDocument();
    expect(screen.queryByText('Parent')).not.toBeInTheDocument();
  });

  it('exposes the type name as the title attribute on the label chip', () => {
    render(
      <Wrapper>
        <UserRelationshipCard {...baseProps} resolvedLabel="Père" />
      </Wrapper>
    );

    const chip = screen.getByText('Père');
    expect(chip).toHaveAttribute('title', 'Parent');
  });
});
