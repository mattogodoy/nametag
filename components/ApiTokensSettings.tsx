'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';

type ApiTokenScope = 'READ' | 'READ_WRITE';

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scope: ApiTokenScope;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreatedApiToken extends ApiToken {
  token: string;
}

export default function ApiTokensSettings() {
  const t = useTranslations('settings.apiTokens');

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('READ_WRITE');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);

  // Plaintext of a just-created token, shown once.
  const [newToken, setNewToken] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTokens = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/user/api-tokens');
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch {
      setError(t('errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setNewToken(null);
    setCopied(false);

    if (!name.trim()) {
      setError(t('errorNameRequired'));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/user/api-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scope,
          expiresAt: expiresAt
            ? new Date(expiresAt).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('errorCreate'));
        return;
      }
      setNewToken(data.apiToken as CreatedApiToken);
      setName('');
      setScope('READ_WRITE');
      setExpiresAt('');
      await loadTokens();
    } catch {
      setError(t('errorConnection'));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t('confirmRevoke'))) return;
    setError('');
    try {
      const res = await fetch(`/api/user/api-tokens/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError(t('errorRevoke'));
        return;
      }
      if (newToken && tokens.find((tok) => tok.id === id)) {
        // no-op; keep the one-time banner until dismissed
      }
      await loadTokens();
    } catch {
      setError(t('errorConnection'));
    }
  };

  const handleCopy = async () => {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (non-secure context); user can select manually.
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded"
        >
          {error}
        </div>
      )}

      {/* One-time plaintext token banner */}
      {newToken && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 rounded-lg p-4 space-y-3">
          <p className="text-green-800 dark:text-green-300 font-medium">
            {t('createdTitle')}
          </p>
          <p className="text-sm text-green-700 dark:text-green-400">
            {t('copyOnce')}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 px-3 py-2 rounded bg-surface border border-border text-foreground text-sm break-all">
              {newToken.token}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
            >
              {copied ? t('copied') : t('copy')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewToken(null)}
            className="text-sm text-muted hover:text-foreground underline"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('createTitle')}</h3>

        <div>
          <label htmlFor="token-name" className="block text-sm font-medium text-muted mb-1">
            {t('nameLabel')}
          </label>
          <input
            id="token-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            maxLength={100}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="token-scope" className="block text-sm font-medium text-muted mb-1">
              {t('scopeLabel')}
            </label>
            <select
              id="token-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiTokenScope)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="READ_WRITE">{t('scopeReadWrite')}</option>
              <option value="READ">{t('scopeRead')}</option>
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="token-expiry" className="block text-sm font-medium text-muted mb-1">
              {t('expiryLabel')}
            </label>
            <input
              id="token-expiry"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? t('creating') : t('createButton')}
          </button>
        </div>
      </form>

      {/* Existing tokens */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">{t('existingTitle')}</h3>

        {loading ? (
          <p className="text-muted">{t('loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-muted">{t('empty')}</p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-surface"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {token.name}
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {token.scope === 'READ' ? t('scopeRead') : t('scopeReadWrite')}
                    </span>
                  </p>
                  <p className="text-sm text-muted truncate">
                    <code>{token.prefix}…</code> · {t('createdAt')}: {formatDate(token.createdAt)} ·{' '}
                    {t('lastUsed')}: {formatDate(token.lastUsedAt)} ·{' '}
                    {t('expires')}: {token.expiresAt ? formatDate(token.expiresAt) : t('never')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(token.id)}
                  className="flex-shrink-0 px-3 py-1.5 text-sm border border-warning/40 text-warning rounded-lg hover:bg-warning/10 transition-colors"
                >
                  {t('revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
