import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../locales/en.json';
import NotificationChannelsCard from '../../components/NotificationChannelsCard';

function renderCard(props: Partial<React.ComponentProps<typeof NotificationChannelsCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationChannelsCard
        emailEnabled={true}
        emailAvailable={true}
        pushAvailable={true}
        devices={[]}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe('NotificationChannelsCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it('explains that push is unavailable when the server has no VAPID keys', () => {
    renderCard({ pushAvailable: false });

    expect(screen.getByText('Push notifications are not set up on this server.')).toBeTruthy();
  });

  it('disables the email toggle when no email provider is configured', () => {
    renderCard({ emailAvailable: false });

    const toggle = screen.getByRole('switch', { name: /email/i });
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
  });

  it('lists subscribed devices', () => {
    renderCard({
      devices: [
        { id: 'sub-1', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120' },
      ],
    });

    expect(screen.getByText(/Chrome/)).toBeTruthy();
  });

  it('says so when there are no devices yet', () => {
    renderCard({ devices: [] });

    expect(screen.getByText('No devices yet.')).toBeTruthy();
  });
});
