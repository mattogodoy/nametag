'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export interface NotificationEndpointSummary {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  lastFailureCode: string | null;
  autoDisabledAt: string | null;
}

interface Props {
  endpoints: NotificationEndpointSummary[];
  canAdd: boolean;
}

interface TestSuccess {
  ok: true;
}

interface TestFailure {
  ok: false;
  code: string;
}

type TestOutcome = TestSuccess | TestFailure;

function isTestOutcome(value: unknown): value is TestOutcome {
  if (typeof value !== 'object' || value === null || !('ok' in value)) {
    return false;
  }

  const ok = (value as { ok: unknown }).ok;
  if (typeof ok !== 'boolean') {
    return false;
  }

  return ok ? true : 'code' in value && typeof (value as { code: unknown }).code === 'string';
}

interface ApiErrorBody {
  error?: string;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Maps a coarse OutboundFailureCode to the translation key shown to the user.
 *
 * `blocked` and `dns` are deliberately kept apart: `blocked` means the URL was
 * refused by policy and is permanent, the user must change it. `dns` means the
 * hostname just did not resolve, which can be transient. Collapsing them would
 * tell a self-hoster whose resolver hiccupped to go change a URL that was
 * correct. Everything else (timeout, refused, tls, redirect, http_5xx,
 * unknown) is transient or not the user's to fix, so it gets the generic
 * retry wording. The raw code is never rendered, only branched on.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  blocked: 'endpointTestBlocked',
  dns: 'endpointTestDns',
  http_4xx: 'endpointTestRejected',
};

interface TestMessage {
  ok: boolean;
  key: string;
}

export default function NotificationEndpointsCard({ endpoints, canAdd }: Props) {
  const t = useTranslations('settings.notifications');
  const tErrors = useTranslations('errors.server');
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [testResults, setTestResults] = useState<Record<string, TestMessage>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function resetForm() {
    setLabel('');
    setUrl('');
    setToken('');
    setFormError(null);
  }

  async function readErrorMessage(response: Response): Promise<string> {
    const data: unknown = await response.json().catch(() => null);
    return isApiErrorBody(data) && data.error ? data.error : tErrors('internalError');
  }

  /**
   * The create endpoint returns brand new, English-only error strings for its
   * 400/409/429 responses. Those are new user-facing text, so unlike
   * readErrorMessage (which surfaces an existing house-pattern string for
   * actions that were already shipped, and rarely fires), this branches on
   * the HTTP status to show a translated message for the cases a user will
   * actually hit. Anything else still falls back to the raw body, so a
   * genuinely unexpected server message is surfaced rather than swallowed.
   */
  async function readAddErrorMessage(response: Response): Promise<string> {
    if (response.status === 409) {
      return t('endpointLimit');
    }
    if (response.status === 400) {
      return t('endpointAddInvalid');
    }
    if (response.status === 429) {
      return t('endpointAddRateLimited');
    }
    return readErrorMessage(response);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/notifications/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'NTFY',
          label,
          url,
          token: token.trim() ? token.trim() : undefined,
        }),
      });

      if (!response.ok) {
        setFormError(await readAddErrorMessage(response));
        return;
      }

      resetForm();
      setShowForm(false);
      router.refresh();
    } catch {
      setFormError(tErrors('internalError'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: string) {
    setBusy(id, true);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const response = await fetch(`/api/notifications/endpoints/${id}/test`, { method: 'POST' });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isTestOutcome(data)) {
        setTestResults((prev) => ({ ...prev, [id]: { ok: false, key: 'endpointTestFailed' } }));
        return;
      }

      if (data.ok) {
        setTestResults((prev) => ({ ...prev, [id]: { ok: true, key: 'endpointTestOk' } }));
      } else {
        const key = MESSAGE_BY_CODE[data.code] ?? 'endpointTestFailed';
        setTestResults((prev) => ({ ...prev, [id]: { ok: false, key } }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, key: 'endpointTestFailed' } }));
    } finally {
      setBusy(id, false);
    }
  }

  async function handleRemove(id: string) {
    setBusy(id, true);
    try {
      const response = await fetch(`/api/notifications/endpoints/${id}`, { method: 'DELETE' });

      if (response.ok) {
        router.refresh();
      } else {
        toast.error(await readErrorMessage(response));
      }
    } catch {
      toast.error(tErrors('internalError'));
    } finally {
      setBusy(id, false);
    }
  }

  async function handleEnable(id: string) {
    setBusy(id, true);
    try {
      const response = await fetch(`/api/notifications/endpoints/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        toast.error(await readErrorMessage(response));
      }
    } catch {
      toast.error(tErrors('internalError'));
    } finally {
      setBusy(id, false);
    }
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">{t('endpointsTitle')}</h2>
      <p className="text-muted mb-6">{t('endpointsDescription')}</p>

      {endpoints.length === 0 ? (
        <p className="text-sm text-muted mb-4">{t('endpointNone')}</p>
      ) : (
        <ul className="space-y-4 mb-4">
          {endpoints.map((endpoint) => {
            const result = testResults[endpoint.id];
            const busy = busyIds.has(endpoint.id);

            return (
              <li key={endpoint.id} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-foreground font-medium truncate">{endpoint.label}</p>
                    <p className="text-sm text-muted break-all">{endpoint.url}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleTest(endpoint.id)}
                      disabled={busy}
                      className="px-3 py-1 rounded-md border border-border disabled:opacity-50"
                    >
                      {t('endpointTest')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemove(endpoint.id)}
                      disabled={busy}
                      className="text-muted hover:text-foreground disabled:opacity-50"
                    >
                      {t('endpointRemove')}
                    </button>
                  </div>
                </div>

                {result && (
                  <p className={`text-sm mt-2 ${result.ok ? 'text-foreground' : 'text-muted'}`}>
                    {t(result.key)}
                  </p>
                )}

                {endpoint.autoDisabledAt && (
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-md bg-muted/20 px-3 py-2">
                    <p className="text-sm text-muted">{t('endpointDisabled')}</p>
                    <button
                      type="button"
                      onClick={() => void handleEnable(endpoint.id)}
                      disabled={busy}
                      className="text-sm text-foreground underline disabled:opacity-50 flex-shrink-0"
                    >
                      {t('endpointEnable')}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!canAdd && <p className="text-sm text-muted mb-4">{t('endpointLimit')}</p>}

      {canAdd && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-3 py-1 rounded-md border border-border"
        >
          {t('endpointAdd')}
        </button>
      )}

      {canAdd && showForm && (
        <form onSubmit={(event) => void handleAdd(event)} className="space-y-3">
          <div>
            <label className="block text-sm text-foreground mb-1" htmlFor="endpoint-label">
              {t('endpointLabel')}
            </label>
            <input
              id="endpoint-label"
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          <div>
            <label className="block text-sm text-foreground mb-1" htmlFor="endpoint-url">
              {t('endpointUrl')}
            </label>
            <input
              id="endpoint-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={t('endpointUrlHint')}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <p className="text-xs text-muted mt-1">{t('endpointUrlHint')}</p>
          </div>

          <div>
            <label className="block text-sm text-foreground mb-1" htmlFor="endpoint-token">
              {t('endpointToken')}
            </label>
            {/* type="password" so a token is never left visible on screen: the
                API never returns one back, and the field must not become the
                one place it could reappear. */}
            <input
              id="endpoint-token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1 rounded-md bg-primary text-white disabled:opacity-50"
            >
              {t('endpointSave')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-3 py-1 rounded-md border border-border"
            >
              {t('endpointCancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
