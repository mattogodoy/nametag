'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

function ResetPasswordForm() {
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
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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

  if (!token) {
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
            <div className="bg-error/20 p-4 rounded-full my-4">
              <span className="icon-[tabler--link-off] size-12 text-error" />
            </div>
            <h2 className="card-title text-2xl text-error">Invalid Reset Link</h2>
            <p className="text-base-content/70">
              This password reset link is invalid or has expired.
            </p>
            <div className="card-actions mt-4">
              <Link href="/forgot-password" className="btn btn-primary">
                Request a new reset link
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
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
              <span className="icon-[tabler--check] size-12 text-success" />
            </div>
            <h2 className="card-title text-2xl text-success">Password Reset Successful</h2>
            <p className="text-base-content/70">
              Your password has been updated. You can now log in with your new password.
            </p>
            <div className="card-actions mt-4">
              <Link href="/login" className="btn btn-primary">
                Go to login
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
              Reset your password
            </h2>
            <p className="text-base-content/60 text-sm">
              Enter your new password below
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
              <label htmlFor="password" className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Min 8 characters"
              />
            </div>

            <div className="form-control">
              <label htmlFor="confirmPassword" className="label">
                <span className="label-text">Confirm New Password</span>
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Repeat password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading && <span className="loading loading-spinner loading-sm" />}
              {isLoading ? 'Resetting...' : 'Reset password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
