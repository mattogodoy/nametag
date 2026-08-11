import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import UnsubscribePage from '../../app/unsubscribe/page';
import enMessages from '../../locales/en.json';

const mocks = vi.hoisted(() => ({
  searchParamsGet: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mocks.searchParamsGet }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

/** Resolve the unsubscribe POST with the reminder type the token carried. */
function respondWith(reminderType: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, reminderType }),
  });
}

describe('unsubscribe page, re-enable link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchParamsGet.mockReturnValue('tok-123');
  });

  // Per-date and per-person reminders are edited on the person, so /people is
  // the right landing spot for those.
  it('points an important-date unsubscriber at the people list', async () => {
    respondWith('IMPORTANT_DATE');

    render(<UnsubscribePage />, { wrapper: Wrapper });

    const link = await screen.findByRole('link', { name: 'Manage Reminder Settings' });
    expect(link).toHaveAttribute('href', '/people');
  });

  it('points a contact-reminder unsubscriber at the people list', async () => {
    respondWith('CONTACT');

    render(<UnsubscribePage />, { wrapper: Wrapper });

    const link = await screen.findByRole('link', { name: 'Manage Reminder Settings' });
    expect(link).toHaveAttribute('href', '/people');
  });

  // The digest is an account setting, so /people is a dead end: there is no
  // control there that turns it back on.
  it('points a weekly-digest unsubscriber at the notification settings', async () => {
    respondWith('WEEKLY_DIGEST');

    render(<UnsubscribePage />, { wrapper: Wrapper });

    const link = await screen.findByRole('link', { name: 'Manage Notification Settings' });
    expect(link).toHaveAttribute('href', '/settings/notifications');
  });

  it('explains that the digest specifically was turned off', async () => {
    respondWith('WEEKLY_DIGEST');

    render(<UnsubscribePage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(
        screen.getByText(/no longer receive the weekly summary email/i)
      ).toBeInTheDocument();
    });
  });
});
