'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type UnsubscribeState = 'loading' | 'success' | 'error';
type ErrorType =
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'ALREADY_USED'
  | 'EXPIRED'
  | 'NETWORK_ERROR'
  | null;

function UnsubscribeContent() {
  const t = useTranslations('unsubscribe');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<UnsubscribeState>(() =>
    !token ? 'error' : 'loading'
  );
  const [errorType, setErrorType] = useState<ErrorType>(() =>
    !token ? 'MISSING_TOKEN' : null
  );
  const [reminderType, setReminderType] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    async function unsubscribe() {
      try {
        const response = await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setState('success');
          setReminderType(data.reminderType);
        } else {
          setState('error');
          setErrorType(data.error || 'NETWORK_ERROR');
        }
      } catch {
        setState('error');
        setErrorType('NETWORK_ERROR');
      }
    }

    unsubscribe();
  }, [token]);

  return (
    <div className="max-w-md w-full bg-card border-2 border-border rounded-lg p-8 text-center">
      {state === 'loading' && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t('processing')}
          </h1>
          <p className="text-muted">{t('pleaseWait')}</p>
        </>
      )}

      {state === 'success' && (
        <>
          <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t('success.title')}
          </h1>
          <p className="text-muted mb-6">
            {reminderType === 'IMPORTANT_DATE' && t('success.importantDate')}
            {reminderType === 'WEEKLY_DIGEST' && t('success.weeklyDigest')}
            {reminderType !== 'IMPORTANT_DATE' &&
              reminderType !== 'WEEKLY_DIGEST' &&
              t('success.contact')}
          </p>
          <div className="space-y-3">
            {/* Per-date and per-person reminders are edited on the person, but
                the digest is an account setting, so /people is a dead end for
                anyone who just unsubscribed from it. */}
            <Link
              href={reminderType === 'WEEKLY_DIGEST' ? '/settings/notifications' : '/people'}
              className="block w-full bg-primary text-on-primary py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
            >
              {reminderType === 'WEEKLY_DIGEST'
                ? t('success.reEnableDigestInSettings')
                : t('success.reEnableInSettings')}
            </Link>
            <Link
              href="/dashboard"
              className="block w-full border-2 border-border py-2 px-4 rounded-lg hover:bg-accent transition-colors"
            >
              {t('success.goToDashboard')}
            </Link>
          </div>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="w-12 h-12 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t('error.title')}
          </h1>
          <p className="text-muted mb-6">
            {errorType === 'INVALID_TOKEN' && t('error.invalid')}
            {errorType === 'ALREADY_USED' && t('error.alreadyUsed')}
            {errorType === 'EXPIRED' && t('error.expired')}
            {errorType === 'MISSING_TOKEN' && t('error.missing')}
            {errorType === 'NETWORK_ERROR' && t('error.network')}
            {!errorType && t('error.generic')}
          </p>
          <Link
            href="/dashboard"
            className="block w-full bg-primary text-on-primary py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('error.goToDashboard')}
          </Link>
        </>
      )}
    </div>
  );
}

function LoadingFallback() {
  const tCommon = useTranslations('common');
  return (
    <div className="max-w-md w-full bg-card border-2 border-border rounded-lg p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted">{tCommon('loading')}</p>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <UnsubscribeContent />
      </Suspense>
    </div>
  );
}
