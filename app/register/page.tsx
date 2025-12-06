'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, surname, nickname }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      setSuccess(true);
    } catch (error) {
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
            <div className="bg-success/20 p-4 rounded-full mb-4">
              <span className="icon-[tabler--mail-check] size-12 text-success" />
            </div>
            <h2 className="card-title text-2xl text-success">Check your email</h2>
            <p className="text-base-content/70">
              We&apos;ve sent a verification link to <strong>{email}</strong>.
            </p>
            <p className="text-sm text-base-content/60">
              Please click the link in the email to verify your account before logging in.
            </p>
            <div className="card-actions mt-4">
              <Link href="/login" className="btn btn-primary">
                Go to login page
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 py-8">
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
              Create your account
            </h2>
            <p className="text-base-content/60 text-sm">
              Start managing your relationships with NameTag
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
              <label htmlFor="name" className="label">
                <span className="label-text">Name *</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="John"
              />
            </div>

            <div className="form-control">
              <label htmlFor="surname" className="label">
                <span className="label-text">Surname</span>
              </label>
              <input
                id="surname"
                name="surname"
                type="text"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                className="input"
                placeholder="Doe (optional)"
              />
            </div>

            <div className="form-control">
              <label htmlFor="nickname" className="label">
                <span className="label-text">Nickname</span>
              </label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="input"
                placeholder="Johnny (optional)"
              />
            </div>

            <div className="form-control">
              <label htmlFor="email" className="label">
                <span className="label-text">Email address *</span>
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
                <span className="label-text">Password *</span>
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
                <span className="label-text">Confirm Password *</span>
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
              {isLoading ? 'Creating account...' : 'Sign up'}
            </button>

            <div className="text-center pt-2">
              <p className="text-sm text-base-content/60">
                Already have an account?{' '}
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
