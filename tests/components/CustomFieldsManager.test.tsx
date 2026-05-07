import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import CustomFieldsManager from '../../components/customFields/CustomFieldsManager';
import enMessages from '../../locales/en.json';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('CustomFieldsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );
  });

  it('shows empty state when there are no templates', () => {
    render(
      <Wrapper>
        <CustomFieldsManager initialTemplates={[]} usage={null} />
      </Wrapper>
    );

    expect(screen.getByText('No custom fields yet')).toBeInTheDocument();
  });

  it('renders a list of templates when provided', () => {
    const templates = [
      {
        id: 'tpl-1',
        name: 'Dietary restriction',
        slug: 'dietary-restriction',
        type: 'TEXT' as const,
        options: [],
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        _count: { values: 3 },
      },
    ];

    render(
      <Wrapper>
        <CustomFieldsManager initialTemplates={templates} usage={null} />
      </Wrapper>
    );

    expect(screen.getByText('Dietary restriction')).toBeInTheDocument();
    expect(screen.getByText('Used by 3 people')).toBeInTheDocument();
  });

  it('shows usage meter when usage is provided', () => {
    render(
      <Wrapper>
        <CustomFieldsManager
          initialTemplates={[]}
          usage={{ allowed: true, current: 2, limit: 5, isUnlimited: false }}
        />
      </Wrapper>
    );

    expect(screen.getByText('2 of 5 custom fields')).toBeInTheDocument();
  });

  it('shows unlimited usage meter when isUnlimited is true', () => {
    render(
      <Wrapper>
        <CustomFieldsManager
          initialTemplates={[]}
          usage={{ allowed: true, current: 4, limit: Infinity, isUnlimited: true }}
        />
      </Wrapper>
    );

    expect(screen.getByText('4 custom fields')).toBeInTheDocument();
  });

  it('disables new field button when usage.allowed is false', () => {
    render(
      <Wrapper>
        <CustomFieldsManager
          initialTemplates={[]}
          usage={{ allowed: false, current: 5, limit: 5, isUnlimited: false }}
        />
      </Wrapper>
    );

    const button = screen.getByRole('button', { name: /new field/i });
    expect(button).toBeDisabled();
  });

  it('enables new field button when usage is null', () => {
    render(
      <Wrapper>
        <CustomFieldsManager initialTemplates={[]} usage={null} />
      </Wrapper>
    );

    const button = screen.getByRole('button', { name: /new field/i });
    expect(button).not.toBeDisabled();
  });
});
