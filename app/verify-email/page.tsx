'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type VerificationState = 'loading' | 'success' | 'error' | 'no-token';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('no-token');
      return;
    }

    async function verifyEmail() {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setState('success');
          setMessage(data.message);
        } else {
          setState('error');
          setMessage(data.error || 'Verification failed');
        }
      } catch {
        setState('error');
        setMessage('Unable to verify email. Please try again.');
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <div className="max-w-md w-full space-y-8 text-center">
      {state === 'loading' && (
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying your email...</p>
        </div>
      )}

      {state === 'success' && (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-4">
              Email Verified!
            </h2>
            <p className="text-green-600 dark:text-green-300">
              {message}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4">
              Verification Failed
            </h2>
            <p className="text-red-600 dark:text-red-300">
              {message}
            </p>
          </div>
          <div className="space-y-2">
            <Link
              href="/register"
              className="inline-block w-full py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
            >
              Register Again
            </Link>
            <Link
              href="/login"
              className="inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              Go to Login
            </Link>
          </div>
        </div>
      )}

      {state === 'no-token' && (
        <div className="space-y-6">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">
              No Verification Token
            </h2>
            <p className="text-yellow-600 dark:text-yellow-300">
              Please use the link from your verification email.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Go to Login
          </Link>
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="max-w-md w-full space-y-8 text-center">
      <div className="space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Suspense fallback={<LoadingFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
