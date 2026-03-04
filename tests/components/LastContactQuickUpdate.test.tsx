import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../../locales/en.json';
import { toast } from 'sonner';

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation (override setup.ts)
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import LastContactQuickUpdate from '../../components/LastContactQuickUpdate';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('LastContactQuickUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('renders last contact date and relative time when date exists', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isoDate = yesterday.toISOString().split('T')[0];

    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact={isoDate}
          dateFormat="MDY"
        />
      </Wrapper>
    );

    // Should show the "Last time you talked" header
    expect(screen.getByText(/last time you talked/i)).toBeInTheDocument();
    // Should show relative time (e.g., "1 day ago")
    expect(screen.getByText(/1 day ago/i)).toBeInTheDocument();
  });

  it('renders a dash when no last contact date exists', () => {
    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact={null}
          dateFormat="MDY"
        />
      </Wrapper>
    );

    expect(screen.getByText(/last time you talked/i)).toBeInTheDocument();
    expect(screen.getByText(/you haven't contacted this person yet/i)).toBeInTheDocument();
  });

  it('shows the button when no date or when date is not today', () => {
    const { rerender } = render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact={null}
          dateFormat="MDY"
        />
      </Wrapper>
    );

    // Button should be present when no date
    expect(screen.getByTitle(/update to today/i)).toBeInTheDocument();

    // Button should also be present when date is in the past
    rerender(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact="2025-01-15"
          dateFormat="MDY"
        />
      </Wrapper>
    );

    expect(screen.getByTitle(/update to today/i)).toBeInTheDocument();
  });

  it('hides the button when last contact is today', () => {
    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact={new Date().toISOString()}
          dateFormat="MDY"
        />
      </Wrapper>
    );

    expect(screen.queryByTitle(/update to today/i)).not.toBeInTheDocument();
  });

  it('calls PUT API with correct payload and shows success toast on click', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    ) as unknown as typeof fetch;
    global.fetch = mockFetch;

    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-42"
          currentLastContact="2025-01-15"
          dateFormat="MDY"
        />
      </Wrapper>
    );

    const button = screen.getByTitle(/update to today/i);
    await user.click(button);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/people/person-42',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.any(String),
        })
      );
    });

    // Verify the body contains today's date
    const calls = vi.mocked(global.fetch).mock.calls;
    const callBody = JSON.parse(
      (calls[0][1] as RequestInit).body as string
    );
    const today = new Date().toISOString().split('T')[0];
    expect(callBody.lastContact).toBe(today);

    // Should show success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    // Should call router.refresh()
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('reverts and shows error toast on API failure', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    ) as unknown as typeof fetch;
    global.fetch = mockFetch;

    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact="2025-01-15"
          dateFormat="MDY"
        />
      </Wrapper>
    );

    const button = screen.getByTitle(/update to today/i);
    await user.click(button);

    // Should show error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });

    // Should NOT show success toast
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('shows contact reminder description when provided', () => {
    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact="2025-01-15"
          dateFormat="MDY"
          contactReminderDescription="Every 2 weeks"
        />
      </Wrapper>
    );

    expect(screen.getByText('Every 2 weeks')).toBeInTheDocument();
  });

  it('disables button while request is in flight', async () => {
    const user = userEvent.setup();

    // Create a fetch that never resolves during the test
    let resolvePromise: (value: unknown) => void;
    const mockFetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
    ) as unknown as typeof fetch;
    global.fetch = mockFetch;

    render(
      <Wrapper>
        <LastContactQuickUpdate
          personId="person-1"
          currentLastContact="2025-01-15"
          dateFormat="MDY"
        />
      </Wrapper>
    );

    const button = screen.getByTitle(/update to today/i);
    await user.click(button);

    // Button should be disabled while loading
    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Resolve the promise to clean up
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    // After resolving, button hides because date is now today
    await waitFor(() => {
      expect(screen.queryByTitle(/update to today/i)).not.toBeInTheDocument();
    });
  });
});
