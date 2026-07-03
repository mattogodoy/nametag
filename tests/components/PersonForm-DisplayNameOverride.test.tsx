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

// Mock SearchIndexProvider
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
  relationshipTypes: [
    { id: 'rt-1', label: 'Friend', color: null },
  ],
  mode: 'create' as const,
  dateFormat: 'MDY' as const,
};

describe('PersonForm display name override - use nickname affordance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers a one-click "use nickname" action when a nickname is set and the override is empty', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PersonForm {...defaultProps} />
      </Wrapper>
    );

    // No nickname yet: the shortcut should not be offered
    expect(screen.queryByRole('button', { name: /use nickname/i })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/nickname/i), 'Johnny');

    const useNicknameButton = screen.getByRole('button', { name: /use nickname/i });
    await user.click(useNicknameButton);

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Johnny');
  });

  it('does not offer the shortcut once the override is filled', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <PersonForm {...defaultProps} />
      </Wrapper>
    );

    await user.type(screen.getByLabelText(/nickname/i), 'Johnny');
    await user.type(screen.getByLabelText(/display name/i), 'Boss');

    expect(screen.queryByRole('button', { name: /use nickname/i })).not.toBeInTheDocument();
  });
});
