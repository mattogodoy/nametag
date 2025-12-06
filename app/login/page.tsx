'use client';

import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
        setResendCooldown(data.retryAfter || 120);
        setError(data.error);
      } else if (response.ok) {
        setResendSuccess(true);
        setError('');
        setResendCooldown(120);
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
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body">
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/logo.svg"
              alt="NameTag Logo"
              width={128}
              height={128}
              priority
            />
            <h2 className="card-title text-2xl mt-4">
              Welcome to NameTag
            </h2>
            <p className="text-base-content/60 text-sm">
              Sign in to manage your relationships
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {resendSuccess && (
              <div className="alert alert-success">
                <span className="icon-[tabler--check] size-5" />
                <span>Verification email sent! Please check your inbox.</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                <span className="icon-[tabler--alert-circle] size-5" />
                <div className="flex-1">
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
                          className="link text-sm"
                        >
                          {resendLoading ? 'Sending...' : 'Resend verification email'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-control">
              <label htmlFor="email" className="label">
                <span className="label-text">Email address</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
              />
            </div>

            <div className="form-control">
              <label htmlFor="password" className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading && <span className="loading loading-spinner loading-sm" />}
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="text-center space-y-2 pt-2">
              <p className="text-sm text-base-content/60">
                <Link href="/forgot-password" className="link link-primary">
                  Forgot your password?
                </Link>
              </p>
              <p className="text-sm text-base-content/60">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="link link-primary">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
