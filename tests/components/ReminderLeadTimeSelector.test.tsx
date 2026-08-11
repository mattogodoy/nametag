import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ReminderLeadTimeSelector from '../../components/ReminderLeadTimeSelector';
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

describe('ReminderLeadTimeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('updates the select and the consequence line immediately, before the request resolves', async () => {
    // Holds the request open so we can assert on the state that exists
    // strictly before it settles, not just eventually after.
    let resolveFetch!: (value: unknown) => void;
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    );

    render(
      <Wrapper>
        <ReminderLeadTimeSelector currentLeadDays={0} disabled={false} />
      </Wrapper>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toHaveValue('0');

    fireEvent.change(select, { target: { value: '7' } });

    // The request is still pending here. If the fix regresses, the select
    // would still read '0' at this point and the summary line would still
    // say the day-of-only sentence.
    expect(select).toHaveValue('7');
    expect(
      screen.getByText('You will get an email 7 days before, and again on the day.')
    ).toBeInTheDocument();

    resolveFetch({ ok: true, json: async () => ({ user: { defaultReminderLeadDays: 7 } }) });
    await waitFor(() => expect(select).not.toBeDisabled());
  });

  it('reverts the select and the consequence line when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Could not save your advance notice setting' }),
    });

    render(
      <Wrapper>
        <ReminderLeadTimeSelector currentLeadDays={0} disabled={false} />
      </Wrapper>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '7' } });

    await waitFor(() => expect(select).toHaveValue('0'));
    expect(
      screen.getByText('You will get an email on the day of each event.')
    ).toBeInTheDocument();
    expect(screen.getByText('Could not save your advance notice setting')).toBeInTheDocument();
  });

  it('exposes an accessible name for the select without repeating the section heading visibly', () => {
    render(
      <Wrapper>
        <ReminderLeadTimeSelector currentLeadDays={0} disabled={false} />
      </Wrapper>
    );

    // getByRole with a name only succeeds if the label association (via
    // htmlFor/id) survived being visually hidden.
    const select = screen.getByRole('combobox', { name: 'Advance notice' });
    expect(select).toBeInTheDocument();
  });
});
