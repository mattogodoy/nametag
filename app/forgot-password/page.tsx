'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setError(data.error);
      } else if (!response.ok) {
        setError(data.error || tErrors('server.internalError'));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(tErrors('server.networkError'));
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="flex flex-col items-center">
            <Image
              src="/logo.svg"
              alt="Nametag Logo"
              width={96}
              height={96}
              priority
            />
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">
              {t('checkYourEmail')}
            </h2>
            <p className="text-green-600 dark:text-green-300 mb-4">
              {t('passwordResetEmailSent', { email: email })}
            </p>
            <p className="text-sm text-green-600 dark:text-green-300">
              {t('resetLinkExpiry')}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block text-primary hover:text-primary-dark"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="Nametag Logo"
            width={96}
            height={96}
            priority
          />
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            {t('forgotPasswordTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            {t('forgotPasswordSubtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="sr-only">
              {t('emailAddress')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-muted text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder={t('emailAddress')}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('sending') : t('sendResetLink')}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted">
              {t('rememberPassword')}{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:text-primary-dark"
              >
                {t('signIn')}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
