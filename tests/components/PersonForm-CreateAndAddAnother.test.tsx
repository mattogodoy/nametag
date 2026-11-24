import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import PersonForm from '../../components/PersonForm';
import enMessages from '../../locales/en.json';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/components/SearchIndexProvider', () => ({
  useSearchIndex: () => ({ refreshIndex: vi.fn(), search: vi.fn(), isReady: false }),
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
  relationshipTypes: [{ id: 'rt-1', label: 'Friend', color: null }],
  dateFormat: 'MDY' as const,
  defaultReminderLeadDays: 0,
};

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(document.getElementById('name') as HTMLInputElement, 'Ada');
  await user.selectOptions(
    document.getElementById('relationshipToUserId') as HTMLSelectElement,
    'rt-1'
  );
}

describe('PersonForm "Create and add another"', () => {
  const originalLocation = window.location;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ person: { id: 'person-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('shows both create actions without opening a menu', () => {
    render(<Wrapper><PersonForm {...defaultProps} mode="create" /></Wrapper>);

    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create and add another' })).toBeInTheDocument();
  });

  it('reopens a blank form after creating', async () => {
    const user = userEvent.setup();
    render(<Wrapper><PersonForm {...defaultProps} mode="create" /></Wrapper>);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create and add another' }));

    await waitFor(() => expect(window.location.href).toBe('/people/new'));
    expect(push).not.toHaveBeenCalled();
  });

  it('opens the new person after a plain create', async () => {
    const user = userEvent.setup();
    render(<Wrapper><PersonForm {...defaultProps} mode="create" /></Wrapper>);

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/people/person-1'));
    expect(window.location.href).toBe('');
  });

  it('does not submit "add another" when required fields are empty', async () => {
    const user = userEvent.setup();
    render(<Wrapper><PersonForm {...defaultProps} mode="create" /></Wrapper>);

    await user.click(screen.getByRole('button', { name: 'Create and add another' }));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
