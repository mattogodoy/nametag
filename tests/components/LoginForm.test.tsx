import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import LoginForm from '../../components/LoginForm';
import enMessages from '../../locales/en.json';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));
vi.mock('@/lib/client-features', () => ({
  fetchAvailableProviders: vi.fn().mockResolvedValue({ google: false, credentials: true, oidc: null }),
}));

const renderForm = (initialError?: boolean) =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LoginForm initialError={initialError} />
    </NextIntlClientProvider>
  );

describe('LoginForm sign-in failure message', () => {
  it('shows a generic message when the page was reached with an error', () => {
    renderForm(true);
    expect(screen.getByText("Sign-in didn't work. Please try again.")).toBeInTheDocument();
  });

  it('shows no message otherwise', () => {
    renderForm();
    expect(screen.queryByText("Sign-in didn't work. Please try again.")).not.toBeInTheDocument();
  });
});
