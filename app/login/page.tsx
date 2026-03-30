'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { fetchAvailableProviders } from '@/lib/client-features';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUnverified, setIsUnverified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showGoogleAuth, setShowGoogleAuth] = useState(false);

  // Fetch available providers
  useEffect(() => {
    fetchAvailableProviders().then((providers) => {
      setShowGoogleAuth(providers.google);
    });
  }, []);

  // Countdown timer for cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsUnverified(false);
    setResendSuccess(false);
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Check if the error is due to unverified email or locked account
        const checkRes = await fetch('/api/auth/check-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const { verified, locked } = await checkRes.json();

        if (locked) {
          setError(tErrors('auth.accountLocked'));
        } else if (!verified) {
          setIsUnverified(true);
          setError(tErrors('auth.emailNotVerified'));
        } else {
          setError(tErrors('auth.invalidCredentials'));
        }
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError(tErrors('server.networkError'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendLoading(true);
    setResendSuccess(false);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.status === 429) {
        // Rate limited
        setResendCooldown(data.retryAfter || 120);
        setError(data.error);
      } else if (response.ok) {
        setResendSuccess(true);
        setError('');
        setResendCooldown(120); // 2 minute cooldown after successful send
      } else {
        setError(data.error || tErrors('email.sendFailed'));
      }
    } catch {
      setError(tErrors('email.sendFailed'));
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="Nametag Logo"
            width={192}
            height={192}
            priority
          />
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            {t('welcomeTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            {t('welcomeSubtitle')}
          </p>
        </div>

        {showGoogleAuth && (
          <div className="mt-8">
            <GoogleSignInButton mode="signin" />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted">
                  {t('orContinueWith')}
                </span>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6 bg-surface border border-border rounded-lg p-8" onSubmit={handleSubmit}>
          {resendSuccess && (
            <div className="bg-primary/10 border border-primary/30 text-primary px-4 py-3 rounded-lg">
              {t('emailSent')} {t('checkInbox')}
            </div>
          )}
          {error && (
            <div className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded-lg">
              <p>{error}</p>
              {isUnverified && !resendSuccess && (
                <div className="mt-2">
                  {resendCooldown > 0 ? (
                    <p className="text-sm">
                      {t('resendCooldown', { seconds: resendCooldown })}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-sm font-medium underline hover:no-underline disabled:opacity-50"
                    >
                      {resendLoading ? tCommon('loading') : t('resendVerification')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="rounded-md space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted mb-2">
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
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-muted text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted mb-2">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-border placeholder-muted text-foreground bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2.5 px-6 border border-transparent text-sm font-semibold rounded-lg text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md active:translate-y-px active:shadow-sm"
            >
              {isLoading ? t('signingIn') : t('login')}
            </button>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted">
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:text-primary-dark transition-colors"
              >
                {t('forgotPassword')}
              </Link>
            </p>
            <p className="text-sm text-muted">
              {t('dontHaveAccount')}{' '}
              <Link
                href="/register"
                className="font-medium text-primary hover:text-primary-dark transition-colors"
              >
                {t('register')}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
