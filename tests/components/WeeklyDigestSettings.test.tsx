import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import WeeklyDigestSettings from '../../components/WeeklyDigestSettings';
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

describe('WeeklyDigestSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('updates the weekday select immediately, before the request resolves', async () => {
    let resolveFetch!: (value: unknown) => void;
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveFetch = resolve; })
    );

    render(
      <Wrapper>
        <WeeklyDigestSettings currentEnabled={true} currentWeekday={1} disabled={false} />
      </Wrapper>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toHaveValue('1');

    fireEvent.change(select, { target: { value: '3' } });

    // Still pending: this is exactly the window where a lagging state
    // would show the old weekday.
    expect(select).toHaveValue('3');

    resolveFetch({ ok: true, json: async () => ({ user: {} }) });
    await waitFor(() => expect(select).not.toBeDisabled());
  });

  it('reverts the weekday select when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Could not save your weekly summary setting' }),
    });

    render(
      <Wrapper>
        <WeeklyDigestSettings currentEnabled={true} currentWeekday={1} disabled={false} />
      </Wrapper>
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '3' } });

    await waitFor(() => expect(select).toHaveValue('1'));
    expect(screen.getByText('Could not save your weekly summary setting')).toBeInTheDocument();
  });

  it('flips the toggle immediately and reverts it when the request fails, following the same pattern as the select', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Could not save your weekly summary setting' }),
    });

    render(
      <Wrapper>
        <WeeklyDigestSettings currentEnabled={false} currentWeekday={1} disabled={false} />
      </Wrapper>
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByText('Could not save your weekly summary setting')).toBeInTheDocument();
  });
});
