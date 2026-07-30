import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import OfflineNotice from '@/components/OfflineNotice';
import enMessages from '../../locales/en.json';
import esMessages from '../../locales/es-ES.json';

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

  it('offers a retry link to home', () => {
    render(<OfflineNotice />, { wrapper: Wrapper });

    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/');
  });

  /*
   * The English assertions above are byte-identical to locales/en.json, so they
   * would pass even if the component hardcoded its copy and never called t().
   * Rendering the same component against Spanish messages is what actually
   * proves the translation layer is wired up.
   */
  it('renders Spanish copy when given Spanish messages', () => {
    render(
      <NextIntlClientProvider locale="es-ES" messages={esMessages}>
        <OfflineNotice />
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reintentar' })).toHaveAttribute('href', '/');
    expect(screen.queryByText("You're offline")).not.toBeInTheDocument();
  });
});
