import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import RootError from '@/app/error';
import enMessages from '../../locales/en.json';

/**
 * app/error.tsx is representative of the six route error boundaries: all of
 * them call useIsOffline() and early-return OfflineNotice before their
 * hardcoded generic error markup. This test guards that wiring without
 * duplicating it six times.
 */
function stubOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    writable: true,
    configurable: true,
    value,
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const error = Object.assign(new Error('boom'), { digest: 'abc123' });

describe('app/error.tsx offline handling', () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');

  afterEach(() => {
    cleanup();
    if (original) {
      Object.defineProperty(window.navigator, 'onLine', original);
    }
  });

  it('renders the offline notice instead of the generic error when offline', () => {
    stubOnLine(false);

    render(<RootError error={error} reset={vi.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong!')).not.toBeInTheDocument();
  });

  it('renders the generic error when online', () => {
    stubOnLine(true);

    render(<RootError error={error} reset={vi.fn()} />, { wrapper: Wrapper });

    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
  });

  it('still logs the error to the server when offline', () => {
    stubOnLine(false);
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());

    render(<RootError error={error} reset={vi.fn()} />, { wrapper: Wrapper });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/log-error',
      expect.objectContaining({ method: 'POST' })
    );

    fetchSpy.mockRestore();
  });
});
