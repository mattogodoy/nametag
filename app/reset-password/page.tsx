'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(tValidation('passwordsDoNotMatch'));
      return;
    }

    // Client-side password validation (matches backend requirements)
    if (password.length < 8) {
      setError(tErrors('password.tooShort', { min: '8' }));
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError(tErrors('password.requiresUppercase'));
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError(tErrors('password.requiresLowercase'));
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError(tErrors('password.requiresNumber'));
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setError(tErrors('password.requiresSpecial'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
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

  if (!token) {
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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4">
              {t('invalidResetLink')}
            </h2>
            <p className="text-red-600 dark:text-red-300">
              {t('resetLinkInvalidOrExpired')}
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('requestNewResetLink')}
          </Link>
        </div>
      </div>
    );
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
              {t('passwordResetSuccessful')}
            </h2>
            <p className="text-green-600 dark:text-green-300">
              {t('passwordResetSuccessMessage')}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors"
          >
            {t('goToLoginButton')}
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
            {t('resetPasswordTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            {t('resetPasswordSubtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-warning/10 border-2 border-warning text-warning px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="sr-only">
                {t('newPassword')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('newPasswordPlaceholder')}
              />
              <PasswordStrengthIndicator password={password} showRequirements={true} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                {t('confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('confirmNewPasswordPlaceholder')}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-black bg-primary hover:bg-primary-dark shadow-lg hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('resetting') : t('resetPassword')}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted">
              {t('rememberPassword')}{' '}
              <Link
                href="/login"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
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

function LoadingFallback() {
  const tCommon = useTranslations('common');
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-muted">{tCommon('loading')}</div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
