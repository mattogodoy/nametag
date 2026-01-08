'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { fetchAvailableProviders } from '@/lib/client-features';

export default function LoginPage() {
  const router = useRouter();
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
        // Check if the error is due to unverified email
        const checkRes = await fetch('/api/auth/check-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const { verified } = await checkRes.json();

        if (!verified) {
          setIsUnverified(true);
          setError('Please verify your email before logging in.');
        } else {
          setError('Invalid email or password');
        }
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('Unable to connect to server. Please check your connection and try again.');
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
        setError(data.error || 'Failed to resend verification email');
      }
    } catch {
      setError('Unable to resend verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-tertiary/10 pointer-events-none"></div>
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl"></div>
      <div className="max-w-md w-full space-y-8 relative">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="NameTag Logo"
            width={192}
            height={192}
            priority
          />
          <h2 className="mt-6 text-center text-3xl font-bold text-foreground">
            Welcome to NameTag
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Sign in to manage your relationships
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
                  Or continue with email
                </span>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6 bg-surface border-2 border-primary/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden" onSubmit={handleSubmit}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
          {resendSuccess && (
            <div className="bg-primary/20 border-2 border-primary text-primary px-4 py-3 rounded-lg shadow-lg shadow-primary/20 relative">
              Verification email sent! Please check your inbox.
            </div>
          )}
          {error && (
            <div className="bg-tertiary/30 border-2 border-tertiary text-tertiary px-4 py-3 rounded-lg shadow-lg shadow-tertiary/20 relative">
              <p>{error}</p>
              {isUnverified && !resendSuccess && (
                <div className="mt-2">
                  {resendCooldown > 0 ? (
                    <p className="text-sm">
                      You can resend in {resendCooldown} seconds
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-sm font-medium underline hover:no-underline disabled:opacity-50"
                    >
                      {resendLoading ? 'Sending...' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="rounded-md space-y-4 relative">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border-2 border-border placeholder-muted text-foreground bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-lg relative block w-full px-4 py-3 border-2 border-border placeholder-muted text-foreground bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="relative">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-6 border-2 border-transparent text-base font-bold rounded-lg text-black bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-primary/50 hover:scale-105"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted">
              <Link
                href="/forgot-password"
                className="font-medium text-primary hover:text-primary-dark transition-colors"
              >
                Forgot your password?
              </Link>
            </p>
            <p className="text-sm text-muted">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-medium text-primary hover:text-primary-dark transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
