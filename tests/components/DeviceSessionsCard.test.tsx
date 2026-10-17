import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import messages from '@/locales/en.json';
import DeviceSessionsCard from '@/components/DeviceSessionsCard';

const sessions = [
  { id: 's1', name: "Matto's iPhone", platform: 'IOS', appVersion: '1.0.0', lastUsedAt: '2026-10-17T10:00:00.000Z', createdAt: '2026-10-01T10:00:00.000Z', current: false },
  { id: 's2', name: 'Pixel', platform: 'ANDROID', appVersion: '1.0.0', lastUsedAt: '2026-10-16T10:00:00.000Z', createdAt: '2026-10-02T10:00:00.000Z', current: false },
];

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DeviceSessionsCard dateFormat="YMD" />
    </NextIntlClientProvider>
  );
}

// ConfirmationModal renders no role="dialog", so the modal is found through
// its heading and the confirm button is queried inside that container.
async function findModal(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title });
  const modal = heading.parentElement;
  if (!modal) throw new Error('modal not found');
  return modal;
}

describe('DeviceSessionsCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists devices with platform, version and dates', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sessions })));
    renderCard();
    expect(await screen.findByText("Matto's iPhone")).toBeInTheDocument();
    expect(screen.getByText('Pixel')).toBeInTheDocument();
    expect(screen.getByText(/Signed in 2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText(/iOS/)).toBeInTheDocument();
    expect(screen.getByText(/Android/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out all devices' })).toBeInTheDocument();
  });

  it('shows the empty state and no sign-out-all button without devices', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ sessions: [] })));
    renderCard();
    expect(await screen.findByText(/No apps are signed in/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out all devices' })).toBeNull();
  });

  it('signs out one device after confirmation and removes it from the list', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderCard();
    const row = (await screen.findByText("Matto's iPhone")).closest('li');
    if (!row) throw new Error('row not found');
    await userEvent.click(within(row).getByRole('button', { name: /Sign out/ }));
    const modal = await findModal("Sign out Matto's iPhone?");
    await userEvent.click(within(modal).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.queryByText("Matto's iPhone")).toBeNull());
    expect(screen.getByText('Pixel')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/user/sessions/s1', { method: 'DELETE' });
  });

  it('signs out all devices after confirmation', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out all devices' }));
    const modal = await findModal('Sign out all devices?');
    await userEvent.click(within(modal).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText(/No apps are signed in/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/user/sessions', { method: 'DELETE' });
  });

  it('keeps the device and shows an error when sign-out fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions })))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }));
    renderCard();
    const row = (await screen.findByText("Matto's iPhone")).closest('li');
    if (!row) throw new Error('row not found');
    await userEvent.click(within(row).getByRole('button', { name: /Sign out/ }));
    const modal = await findModal("Sign out Matto's iPhone?");
    await userEvent.click(within(modal).getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText(/Couldn't sign out that device/)).toBeInTheDocument();
    expect(screen.getAllByText("Matto's iPhone").length).toBeGreaterThan(0);
  });

  it('shows an error when loading fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    renderCard();
    expect(await screen.findByText(/Couldn't load your devices/)).toBeInTheDocument();
  });
});
