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
    <div className="card bg-base-100 w-full max-w-md shadow-xl">
      <div className="card-body items-center text-center">
        {state === 'loading' && (
          <>
            <span className="loading loading-spinner loading-lg text-primary" />
            <p className="text-base-content/60 mt-4">Verifying your email...</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="bg-success/20 p-4 rounded-full mb-4">
              <span className="icon-[tabler--check] size-12 text-success" />
            </div>
            <h2 className="card-title text-2xl text-success">Email Verified!</h2>
            <p className="text-base-content/70">{message}</p>
            <div className="card-actions mt-4">
              <Link href="/login" className="btn btn-primary w-full">
                Go to Login
              </Link>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="bg-error/20 p-4 rounded-full mb-4">
              <span className="icon-[tabler--x] size-12 text-error" />
            </div>
            <h2 className="card-title text-2xl text-error">Verification Failed</h2>
            <p className="text-base-content/70">{message}</p>
            <div className="card-actions mt-4 flex-col w-full gap-2">
              <Link href="/register" className="btn btn-primary w-full">
                Register Again
              </Link>
              <Link href="/login" className="link link-primary text-sm">
                Go to Login
              </Link>
            </div>
          </>
        )}

        {state === 'no-token' && (
          <>
            <div className="bg-warning/20 p-4 rounded-full mb-4">
              <span className="icon-[tabler--alert-triangle] size-12 text-warning" />
            </div>
            <h2 className="card-title text-2xl text-warning">No Verification Token</h2>
            <p className="text-base-content/70">
              Please use the link from your verification email.
            </p>
            <div className="card-actions mt-4">
              <Link href="/login" className="link link-primary">
                Go to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="card bg-base-100 w-full max-w-md shadow-xl">
      <div className="card-body items-center text-center">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="text-base-content/60 mt-4">Loading...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <Suspense fallback={<LoadingFallback />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
