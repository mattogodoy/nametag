import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

// vi.mock factories are hoisted above every other statement in the file,
// including plain const declarations, so the mock functions they reference
// have to be created through vi.hoisted rather than assigned normally.
const { mockRefresh, mockToastError } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: mockToastError,
  },
}));

import messages from '../../locales/en.json';
import jaMessages from '../../locales/ja-JP.json';
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

/** jsdom has no matchMedia, so every test that cares about the iOS hint has to provide one. */
function stubMatchMedia(standalone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: standalone && query.includes('display-mode: standalone'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    writable: true,
    configurable: true,
    value: ua,
  });
}

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 Chrome/120';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

interface StubSubscription {
  toJSON: () => Record<string, unknown>;
}

/**
 * jsdom has no serviceWorker or PushManager, so every test that exercises the
 * push flow has to fabricate both. `subscribe` defaults to a resolved stub
 * subscription; pass a rejecting mock to exercise the failure path.
 */
function stubServiceWorker(
  subscription: StubSubscription | null,
  subscribe: () => Promise<StubSubscription> = vi.fn().mockResolvedValue({ toJSON: () => ({}) })
) {
  const getSubscription = vi.fn().mockResolvedValue(subscription);
  const subscribeSpy = vi.fn(subscribe);

  Object.defineProperty(window, 'PushManager', {
    writable: true,
    configurable: true,
    value: class StubPushManager {},
  });

  Object.defineProperty(navigator, 'serviceWorker', {
    writable: true,
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription, subscribe: subscribeSpy },
      }),
    },
  });

  return { getSubscription, subscribe: subscribeSpy };
}

function stubNotification(
  permission: NotificationPermission,
  requestPermission: () => Promise<NotificationPermission> = vi.fn().mockResolvedValue(permission)
) {
  Object.defineProperty(window, 'Notification', {
    writable: true,
    configurable: true,
    value: {
      permission,
      requestPermission,
    },
  });
}

describe('NotificationChannelsCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    setUserAgent(DESKTOP_UA);
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(window, 'Notification');
    Reflect.deleteProperty(window, 'PushManager');
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

    expect(screen.getByText('Chrome on macOS')).toBeTruthy();
  });

  it('says so when there are no devices yet', () => {
    renderCard({ devices: [] });

    expect(screen.getByText('No devices yet.')).toBeTruthy();
  });

  it('shows the translated fallback for a device with no user agent', () => {
    renderCard({
      devices: [
        { id: 'sub-2', userAgent: null },
      ],
    });

    expect(screen.getByText('Unknown device')).toBeTruthy();
  });

  describe('email toggle', () => {
    it('reverts to its prior state when the update request rejects', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
      renderCard({ emailEnabled: true });

      const toggle = screen.getByRole('switch', { name: 'Email' });
      fireEvent.click(toggle);

      // The click flips the switch optimistically before the rejected fetch
      // has a chance to be caught.
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      await waitFor(() => {
        expect(toggle.getAttribute('aria-checked')).toBe('true');
      });
      expect(mockToastError).toHaveBeenCalled();
    });

    it('reverts to its prior state when the update request responds not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
      renderCard({ emailEnabled: true });

      const toggle = screen.getByRole('switch', { name: 'Email' });
      fireEvent.click(toggle);

      await waitFor(() => {
        expect(toggle.getAttribute('aria-checked')).toBe('true');
      });
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  describe('push permission handling', () => {
    it('leaves Enable available when the permission prompt is dismissed', async () => {
      stubServiceWorker(null);
      stubNotification('default', vi.fn().mockResolvedValue('default'));

      renderCard();

      const enableButton = await screen.findByRole('button', { name: 'Enable on this device' });
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(
          screen.queryByText('Notifications are blocked for this site in your browser settings.')
        ).not.toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Enable on this device' })).toBeInTheDocument();
    });

    it('shows the blocked copy when the permission prompt is denied', async () => {
      stubServiceWorker(null);
      stubNotification('default', vi.fn().mockResolvedValue('denied'));

      renderCard();

      const enableButton = await screen.findByRole('button', { name: 'Enable on this device' });
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(
          screen.getByText('Notifications are blocked for this site in your browser settings.')
        ).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Enable on this device' })).not.toBeInTheDocument();
    });
  });

  describe('enabling push', () => {
    it('surfaces a toast when the subscribe call fails', async () => {
      stubServiceWorker(null, vi.fn().mockRejectedValue(new Error('subscribe failed')));
      stubNotification('granted');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicKey: 'AA' }) })
      );

      renderCard();

      const enableButton = await screen.findByRole('button', { name: 'Enable on this device' });
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
      // Nothing was ever subscribed, so the device list never refreshed.
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Enable on this device' })).toBeInTheDocument();
    });

    it('calls router.refresh and adds no placeholder device row on success', async () => {
      const { subscribe } = stubServiceWorker(null);
      stubNotification('granted');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ publicKey: 'AA' }) })
      );

      renderCard({ devices: [] });

      const enableButton = await screen.findByRole('button', { name: 'Enable on this device' });
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
      expect(subscribe).toHaveBeenCalled();
      // The real device id only exists on the server. Until the parent
      // re-fetches, the list must stay exactly what was passed in.
      expect(screen.getByText('No devices yet.')).toBeInTheDocument();
    });
  });

  describe('iOS install hint', () => {
    it('never renders together with the enabled-on-this-device copy', async () => {
      setUserAgent(IPHONE_UA);
      stubMatchMedia(false);
      stubServiceWorker({ toJSON: () => ({}) });
      stubNotification('granted');

      renderCard();

      await waitFor(() => {
        expect(screen.getByText('Enabled on this device')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('On iPhone and iPad, add Nametag to your home screen first.')
      ).not.toBeInTheDocument();
    });
  });
  describe('device label translation', () => {
    it('renders the device label through the locale template rather than a hardcoded string', () => {
      // The old hardcoded implementation always produced "Chrome on macOS".
      // Rendering with Japanese messages, where the template puts the OS
      // first, is the only way to prove the translation is actually wired up.
      render(
        <NextIntlClientProvider locale="ja-JP" messages={jaMessages}>
          <NotificationChannelsCard
            emailEnabled={true}
            emailAvailable={true}
            pushAvailable={true}
            devices={[{ id: 'sub-1', userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120' }]}
          />
        </NextIntlClientProvider>
      );

      expect(screen.getByText('macOS の Chrome')).toBeTruthy();
    });
  });
});
