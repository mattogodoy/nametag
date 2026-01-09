'use client';

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { fetchAvailableProviders } from '@/lib/client-features';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);

  // Fetch available providers
  useEffect(() => {
    fetchAvailableProviders().then((providers) => {
      setShowGoogleAuth(providers.google);
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setValidationErrors([]);

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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, surname, nickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if there are detailed validation errors
        if (data.details && Array.isArray(data.details)) {
          setValidationErrors(data.details);
          setError(data.error || tErrors('server.internalError'));
        } else {
          setError(data.error || tErrors('server.internalError'));
        }
        return;
      }

      // Show success message instead of auto-login
      setSuccess(true);
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
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">
              {t('checkYourEmail')}
            </h2>
            <p className="text-green-600 dark:text-green-300 mb-4">
              {t('verificationEmailSent', { email: email })}
            </p>
            <p className="text-sm text-green-600 dark:text-green-300">
              {t('verificationEmailInstructions')}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t('goToLogin')}
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
            {t('createAccountTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            {t('createAccountSubtitle')}
          </p>
        </div>

        {showGoogleAuth && (
          <div className="mt-8">
            <GoogleSignInButton mode="signup" />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted">
                  {t('orSignUpWithEmail')}
                </span>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-warning/10 border-2 border-warning text-warning px-4 py-3 rounded">
              <div className="font-medium">{error}</div>
              {validationErrors.length > 0 && (
                <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
                  {validationErrors.map((err, index) => (
                    <li key={index}>
                      <strong>{err.field}:</strong> {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="name" className="sr-only">
                {tCommon('name')}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('namePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="surname" className="sr-only">
                {t('surname')}
              </label>
              <input
                id="surname"
                name="surname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('surnamePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="nickname" className="sr-only">
                {t('nickname')}
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('nicknamePlaceholder')}
              />
            </div>
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
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-gray-500 dark:placeholder-gray-400 text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('emailAddress')}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="sr-only">
                {t('password')}
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
                placeholder={t('password')}
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
                placeholder={t('confirmPasswordPlaceholder')}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-semibold rounded-lg text-black bg-primary hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t('creatingAccount') : t('signUp')}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted">
              {t('alreadyHaveAccount')}{' '}
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
