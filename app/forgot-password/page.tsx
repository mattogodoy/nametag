'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
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
        setError(data.error || 'Something went wrong');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <div className="card bg-base-100 w-full max-w-md shadow-xl">
          <div className="card-body items-center text-center">
            <Image
              src="/logo.svg"
              alt="NameTag Logo"
              width={96}
              height={96}
              priority
            />
            <div className="bg-success/20 p-4 rounded-full my-4">
              <span className="icon-[tabler--mail-check] size-12 text-success" />
            </div>
            <h2 className="card-title text-2xl text-success">Check your email</h2>
            <p className="text-base-content/70">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link.
            </p>
            <p className="text-sm text-base-content/60">
              The link will expire in 1 hour.
            </p>
            <div className="card-actions mt-4">
              <Link href="/login" className="btn btn-primary">
                Back to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card bg-base-100 w-full max-w-md shadow-xl">
        <div className="card-body">
          <div className="flex flex-col items-center mb-6">
            <Image
              src="/logo.svg"
              alt="NameTag Logo"
              width={96}
              height={96}
              priority
            />
            <h2 className="card-title text-2xl mt-4">
              Forgot your password?
            </h2>
            <p className="text-base-content/60 text-sm">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span className="icon-[tabler--alert-circle] size-5" />
                <span>{error}</span>
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

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading && <span className="loading loading-spinner loading-sm" />}
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>

            <div className="text-center pt-2">
              <p className="text-sm text-base-content/60">
                Remember your password?{' '}
                <Link href="/login" className="link link-primary">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
