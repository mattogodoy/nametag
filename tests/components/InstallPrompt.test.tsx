import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import InstallPrompt from '@/components/InstallPrompt';
import InstallAppSettings from '@/components/InstallAppSettings';
import enMessages from '../../locales/en.json';
import esMessages from '../../locales/es-ES.json';

const DISMISS_KEY = 'nametag.installPromptDismissed';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

/** jsdom has no matchMedia, so every test has to provide one. */
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

/** iPadOS 13+ and real Macs both send this UA; only touch points tell them apart. */
function setMaxTouchPoints(points: number) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    writable: true,
    configurable: true,
    value: points,
  });
}

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36';
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
/** iPadOS 13+ Safari sends this desktop UA by default. */
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';

/** Dispatches a beforeinstallprompt-shaped event with a spy prompt(). */
function fireInstallPromptEvent(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  act(() => {
    window.dispatchEvent(event);
  });
  return prompt;
}

describe('InstallPrompt banner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setUserAgent(ANDROID_UA);
    // Default to no touch points so tests that do not care about iPad
    // detection cannot accidentally leak a stale value from another test.
    setMaxTouchPoints(0);
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing until the browser says the app is installable', () => {
    const { container } = render(<InstallPrompt />, { wrapper: Wrapper });
    expect(container.firstChild).toBeNull();
  });

  it('appears once beforeinstallprompt fires', () => {
    render(<InstallPrompt />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    expect(screen.getByText('Install Nametag')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('suppresses the browser mini-infobar so ours is the only prompt', () => {
    render(<InstallPrompt />, { wrapper: Wrapper });

    const event = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void> };
    event.prompt = vi.fn().mockResolvedValue(undefined);
    const preventDefault = vi.spyOn(event, 'preventDefault');

    act(() => {
      window.dispatchEvent(event);
    });

    // Without preventDefault, Chrome shows its own install bar alongside our
    // banner. Nothing else in this file would notice that line going missing.
    expect(preventDefault).toHaveBeenCalled();
  });

  it('calls the captured prompt when Install is clicked, then retires the button', async () => {
    render(<InstallPrompt />, { wrapper: Wrapper });
    const prompt = fireInstallPromptEvent();

    // act, because promptInstall is async: without it the assertions below run
    // before the state update flushes and the post-click behaviour is untested.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });

    expect(prompt).toHaveBeenCalledTimes(1);
    // The captured event is single-use, so the button must not stay clickable.
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  it('does not call prompt twice when Install is double-clicked', async () => {
    render(<InstallPrompt />, { wrapper: Wrapper });

    let releasePrompt: (() => void) | undefined;
    const prompt = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePrompt = resolve;
        })
    );
    fireInstallPromptEvent(prompt);

    const button = screen.getByRole('button', { name: 'Install' });
    fireEvent.click(button);
    fireEvent.click(button);

    await act(async () => {
      releasePrompt?.();
    });

    // Invoking a spent BeforeInstallPromptEvent a second time is
    // browser-defined, so the hook has to make it unreachable.
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('still dismisses when localStorage is unavailable', () => {
    // Safari private mode throws on access rather than returning null.
    const real = window.localStorage;
    const denied = () => {
      throw new Error('SecurityError');
    };
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: { getItem: denied, setItem: denied, clear: () => {} },
    });

    // try/finally, not a bare override: beforeEach calls localStorage.clear(),
    // so leaving a throwing stub in place would cascade into every later test.
    try {
      render(<InstallPrompt />, { wrapper: Wrapper });
      fireInstallPromptEvent();

      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

      // A banner whose dismiss button silently does nothing is worse than one
      // that forgets the dismissal on the next page load.
      expect(screen.queryByText('Install Nametag')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'localStorage', {
        writable: true,
        configurable: true,
        value: real,
      });
    }
  });

  it('renders nothing when already running installed', () => {
    stubMatchMedia(true);

    const { container } = render(<InstallPrompt />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    expect(container.firstChild).toBeNull();
  });

  it('hides and records dismissal when Not now is clicked', () => {
    render(<InstallPrompt />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Install Nametag')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISS_KEY)).toBe('1');
  });

  it('stays hidden on a later visit after being dismissed', () => {
    window.localStorage.setItem(DISMISS_KEY, '1');

    const { container } = render(<InstallPrompt />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    expect(container.firstChild).toBeNull();
  });

  it('shows iOS instructions without waiting for an event that never fires', () => {
    setUserAgent(IPHONE_UA);

    render(<InstallPrompt />, { wrapper: Wrapper });

    expect(screen.getByText('Add to your home screen')).toBeInTheDocument();
    expect(screen.getByText('Tap the Share button in Safari')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
  });

  /*
   * The English assertions above are byte-identical to locales/en.json, so they
   * would pass even if the component hardcoded its copy and never called t().
   * Rendering against Spanish messages is what proves the translation layer is
   * actually wired up. This component carries ten translated keys, so it is the
   * one most worth guarding.
   */
  it('renders Spanish copy when given Spanish messages', () => {
    render(
      <NextIntlClientProvider locale="es-ES" messages={esMessages}>
        <InstallPrompt />
      </NextIntlClientProvider>
    );
    fireInstallPromptEvent();

    expect(screen.getByText('Instalar Nametag')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    expect(screen.queryByText('Install Nametag')).not.toBeInTheDocument();
  });
});

describe('InstallAppSettings section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setUserAgent(ANDROID_UA);
    // Default to no touch points so tests that do not care about iPad
    // detection cannot accidentally leak a stale value from another test.
    setMaxTouchPoints(0);
    stubMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
  });

  it('confirms installation when running installed', () => {
    stubMatchMedia(true);

    render(<InstallAppSettings />, { wrapper: Wrapper });

    expect(screen.getByText('Nametag is installed on this device.')).toBeInTheDocument();
  });

  it('offers an install button once installable', () => {
    render(<InstallAppSettings />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });

  it('shows iOS instructions on iPhone', () => {
    setUserAgent(IPHONE_UA);

    render(<InstallAppSettings />, { wrapper: Wrapper });

    expect(screen.getByText('Tap the Share button in Safari')).toBeInTheDocument();
    expect(screen.getByText('Scroll down and tap Add to Home Screen')).toBeInTheDocument();
    expect(screen.getByText('Tap Add')).toBeInTheDocument();
  });

  it('explains when the browser cannot install at all', () => {
    render(<InstallAppSettings />, { wrapper: Wrapper });

    // Desktop Firefox: no beforeinstallprompt, not iOS, not standalone.
    expect(
      screen.getByText(
        'Your browser may be able to install this from its own menu. Look for Add to Home Screen, Install, or Add to Dock.'
      )
    ).toBeInTheDocument();
  });

  it('shows iOS instructions on iPad, which sends a desktop macOS user agent', () => {
    // iPadOS 13+ Safari sends this UA by default, so only touch points
    // distinguish it from a real Mac.
    setUserAgent(IPAD_DESKTOP_UA);
    setMaxTouchPoints(5);

    render(<InstallAppSettings />, { wrapper: Wrapper });

    expect(screen.getByText('Tap the Share button in Safari')).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Your browser may be able to install this from its own menu. Look for Add to Home Screen, Install, or Add to Dock.'
      )
    ).not.toBeInTheDocument();
  });

  it('does not treat a real Mac (no touch points) as an iPad', () => {
    setUserAgent(IPAD_DESKTOP_UA);
    setMaxTouchPoints(0);

    render(<InstallAppSettings />, { wrapper: Wrapper });

    expect(screen.queryByText('Tap the Share button in Safari')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Your browser may be able to install this from its own menu. Look for Add to Home Screen, Install, or Add to Dock.'
      )
    ).toBeInTheDocument();
  });

  // Unlike the banner, this section is always available.
  it('ignores a recorded banner dismissal', () => {
    window.localStorage.setItem(DISMISS_KEY, '1');

    render(<InstallAppSettings />, { wrapper: Wrapper });
    fireInstallPromptEvent();

    expect(screen.getByRole('button', { name: 'Install' })).toBeInTheDocument();
  });
});
