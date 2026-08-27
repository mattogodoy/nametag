'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { OutboundFailureCode } from '@/lib/notifications/outbound';

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
  code?: string;
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
 *
 * Typed against OutboundFailureCode rather than a bare `Record<string,
 * string>` so that renaming one of those codes is a compile error here
 * instead of a silent downgrade to the generic message: exactly the failure
 * mode this whole feature exists to avoid.
 */
const MESSAGE_BY_CODE: Partial<Record<OutboundFailureCode, string>> = {
  blocked: 'endpointTestBlocked',
  dns: 'endpointTestDns',
  http_4xx: 'endpointTestRejected',
};

/**
 * `data.code` crosses a network boundary as a plain string and could be
 * anything, so it cannot be typed as OutboundFailureCode at the point it is
 * read. The cast below only ever feeds a lookup that falls back safely when
 * the key is absent, so an unrecognised value degrades to the generic
 * message rather than producing a wrong one.
 */
function messageKeyForOutboundCode(code: string): string {
  return MESSAGE_BY_CODE[code as OutboundFailureCode] ?? 'endpointTestFailed';
}

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
   * actually hit.
   *
   * The 400 case carries its own machine-readable `code` from the route
   * (`policy`, `dns`, or `invalid`), and that distinction matters here for
   * exactly the same reason it matters on the test-send path: `policy` is a
   * permanent refusal, the user must change the URL, while `dns` can be a
   * transient resolver hiccup on an otherwise-correct URL. Reusing
   * endpointTestBlocked / endpointTestDns keeps that contrast intact without
   * new locale keys, since the wording already fits either screen.
   *
   * Anything else still falls back to the raw body, so a genuinely unexpected
   * server message is surfaced rather than swallowed.
   */
  async function readAddErrorMessage(response: Response): Promise<string> {
    if (response.status === 409) {
      return t('endpointLimit');
    }
    if (response.status === 400) {
      const data: unknown = await response.json().catch(() => null);
      const code = isApiErrorBody(data) ? data.code : undefined;
      if (code === 'dns') return t('endpointTestDns');
      if (code === 'policy') return t('endpointTestBlocked');
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
        setTestResults((prev) => ({
          ...prev,
          [id]: { ok: false, key: messageKeyForOutboundCode(data.code) },
        }));
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

  const FOCUS_RING = 'focus:outline-none focus:ring-2 focus:ring-primary';

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
                      className={`px-3 py-1 rounded-md border border-border disabled:opacity-50 ${FOCUS_RING}`}
                    >
                      {t('endpointTest')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemove(endpoint.id)}
                      disabled={busy}
                      className={`text-muted hover:text-foreground disabled:opacity-50 rounded ${FOCUS_RING}`}
                    >
                      {t('endpointRemove')}
                    </button>
                  </div>
                </div>

                {result && (
                  <p
                    role="alert"
                    className={`text-sm mt-2 ${result.ok ? 'text-foreground' : 'text-muted'}`}
                  >
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
                      className={`text-sm text-foreground underline disabled:opacity-50 flex-shrink-0 rounded ${FOCUS_RING}`}
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
          className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
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
              maxLength={60}
              className={`w-full rounded-md border border-border bg-background px-3 py-2 text-foreground ${FOCUS_RING}`}
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
              required
              maxLength={500}
              aria-describedby="endpoint-url-hint"
              className={`w-full rounded-md border border-border bg-background px-3 py-2 text-foreground ${FOCUS_RING}`}
            />
            {/* No placeholder here: the same text is already the visible
                helper paragraph below, linked with aria-describedby. A
                placeholder duplicating it would be announced twice. */}
            <p id="endpoint-url-hint" className="text-xs text-muted mt-1">
              {t('endpointUrlHint')}
            </p>
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
              className={`w-full rounded-md border border-border bg-background px-3 py-2 text-foreground ${FOCUS_RING}`}
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className={`px-3 py-1 rounded-md bg-primary text-white disabled:opacity-50 ${FOCUS_RING}`}
            >
              {t('endpointSave')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
            >
              {t('endpointCancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
