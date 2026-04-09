'use client';

import { useState, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface GoogleConnectFormProps {
  oauthConfigured: boolean;
  serviceAccountAvailable: boolean;
}

export default function GoogleConnectForm({
  oauthConfigured,
  serviceAccountAvailable,
}: GoogleConnectFormProps) {
  const t = useTranslations('settings.integrations.google');
  const [jsonKey, setJsonKey] = useState('');
  const [delegatedEmail, setDelegatedEmail] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleOAuthConnect = async () => {
    await signIn('google', { callbackUrl: '/settings/integrations' });
  };

  const handleServiceAccountConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonKey.trim() || !delegatedEmail.trim()) return;

    setConnecting(true);
    try {
      const res = await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authMode: 'service_account',
          serviceAccountKey: jsonKey.trim(),
          delegatedEmail: delegatedEmail.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Connection failed');
      }

      toast.success(t('connectSuccess'));
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('connectError'));
    } finally {
      setConnecting(false);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result;
        if (typeof text === 'string') {
          setJsonKey(text);
        }
      };
      reader.readAsText(file);
    }
  }, []);

  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {t('connectTitle')}
      </h3>
      <p className="text-sm text-muted mb-6">
        {t('connectDescription')}
      </p>

      {/* OAuth sign-in */}
      {oauthConfigured && (
        <div className="mb-6">
          <button
            onClick={handleOAuthConnect}
            className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-border rounded-lg shadow-sm bg-surface hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm font-medium text-foreground">
              {t('oauthButton')}
            </span>
          </button>
        </div>
      )}

      {/* Divider if both modes available */}
      {oauthConfigured && serviceAccountAvailable && (
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-surface px-2 text-muted">or</span>
          </div>
        </div>
      )}

      {/* Service Account setup */}
      {serviceAccountAvailable && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-1">
            {t('serviceAccountTitle')}
          </h4>
          <p className="text-sm text-muted mb-4">
            {t('serviceAccountDescription')}
          </p>

          <form onSubmit={handleServiceAccountConnect} className="space-y-4">
            <div>
              <label htmlFor="json-key" className="block text-sm font-medium text-foreground mb-1">
                {t('jsonKeyLabel')}
              </label>
              <textarea
                id="json-key"
                rows={6}
                value={jsonKey}
                onChange={(e) => setJsonKey(e.target.value)}
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                placeholder={t('jsonKeyPlaceholder')}
                className="block w-full rounded-md border border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary text-sm p-3 font-mono"
                required
              />
            </div>

            <div>
              <label htmlFor="delegated-email" className="block text-sm font-medium text-foreground mb-1">
                {t('delegatedEmailLabel')}
              </label>
              <input
                id="delegated-email"
                type="email"
                value={delegatedEmail}
                onChange={(e) => setDelegatedEmail(e.target.value)}
                placeholder={t('delegatedEmailPlaceholder')}
                className="block w-full rounded-md border border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary text-sm p-2"
                required
              />
            </div>

            <button
              type="submit"
              disabled={connecting}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {connecting ? t('connecting') : t('connectButton')}
            </button>
          </form>
        </div>
      )}

      {/* No mode available */}
      {!oauthConfigured && !serviceAccountAvailable && (
        <p className="text-sm text-muted">
          No Google integration method is configured. Please set up Google OAuth credentials or a service account in your environment.
        </p>
      )}
    </div>
  );
}
