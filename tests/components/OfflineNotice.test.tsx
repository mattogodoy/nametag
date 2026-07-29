import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import OfflineNotice from '@/components/OfflineNotice';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('OfflineNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('explains that the user is offline', () => {
    render(<OfflineNotice />, { wrapper: Wrapper });

    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByText(/needs a connection to show your people/i)).toBeInTheDocument();
  });

  it('offers a retry button', () => {
    render(<OfflineNotice />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('reloads the page when retry is clicked', () => {
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      // href is needed alongside reload: next/image resolves its src against
      // window.location.href during render, and a bare stub without it makes
      // the URL constructor throw.
      value: { reload, href: window.location.href },
    });

    render(<OfflineNotice />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
