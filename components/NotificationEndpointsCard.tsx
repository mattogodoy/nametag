'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import TooltipIcon from '@/components/ui/TooltipIcon';
import type { OutboundFailureCode } from '@/lib/notifications/outbound';

type EndpointType = 'NTFY' | 'WEBHOOK';

export interface NotificationEndpointSummary {
  id: string;
  type: EndpointType;
  label: string;
  url: string;
  enabled: boolean;
  lastFailureCode: string | null;
  autoDisabledAt: string | null;
}

interface Props {
  endpoints: NotificationEndpointSummary[];
  canAdd: boolean;
  canUseWebhooks: boolean;
  /**
   * Whether this instance requires webhook endpoints to be https://. Mirrors
   * `outboundPolicy().requireHttps`, which is true only in SaaS mode.
   */
  requireHttps: boolean;
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

function extractSecret(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const secret = (value as { secret?: unknown }).secret;
  return typeof secret === 'string' ? secret : null;
}

/**
 * Maps a coarse OutboundFailureCode to the translation key shown to the user.
 *
 * `blocked` and `dns` are deliberately kept apart: `blocked` means the URL was
 * refused by policy and is permanent, the user must change it. `dns` means the
 * hostname just did not resolve, which can be transient. Collapsing them would
 * tell a self-hoster whose resolver hiccupped to go change a URL that was
 * correct. `tls` and `redirect` are also both permanent (a bad certificate or
 * a topic URL that redirects elsewhere is not going to fix itself), so each
 * gets its own wording rather than falling into the generic retry message.
 * `http_429` gets its own wording too: the destination itself asked us to
 * slow down, which is transient and not something a token or topic name fix
 * addresses. Everything left (timeout, refused, http_5xx, unknown) is
 * transient or not the user's to fix, so it gets the generic retry wording.
 * The raw code is never rendered, only branched on.
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
  http_429: 'endpointTestRateLimited',
  tls: 'endpointTestTls',
  unexpected_response: 'endpointTestNotNtfy',
};

/**
 * Overrides applied only when the message is shown against an already-saved
 * destination (the test-send result, or the auto-disabled banner), rather
 * than against the create form.
 *
 * `updateEndpointSchema` accepts only `label` and `enabled`: neither the URL
 * nor the token of a saved destination can be edited. `endpointTestBlocked`
 * and `endpointTestRejected` both read as if editing were possible ("change
 * it and save again", "check the topic name and the access token"), which is
 * correct on the create form but leaves a saved row's message pointing at an
 * action the UI cannot perform. The saved variants point at the one action
 * that actually exists: remove the destination and add it again.
 */
const SAVED_MESSAGE_OVERRIDES: Partial<Record<OutboundFailureCode, string>> = {
  blocked: 'endpointTestBlockedSaved',
  http_4xx: 'endpointTestRejectedSaved',
  redirect: 'endpointTestRedirectSaved',
  unexpected_response: 'endpointTestNotNtfySaved',
};

type MessageContext = 'form' | 'saved';

/**
 * Only `http_4xx` needs webhook-specific copy: the ntfy wording says "check
 * the topic name and the access token", which makes no sense for a webhook.
 */
function messageKeyForOutboundCode(
  code: string,
  context: MessageContext,
  type: EndpointType
): string {
  if (type === 'WEBHOOK' && code === 'http_4xx') {
    return context === 'saved' ? 'webhookTestRejectedSaved' : 'webhookTestRejected';
  }
  if (context === 'saved') {
    const override = SAVED_MESSAGE_OVERRIDES[code as OutboundFailureCode];
    if (override) return override;
  }
  return MESSAGE_BY_CODE[code as OutboundFailureCode] ?? 'endpointTestFailed';
}

interface TestMessage {
  ok: boolean;
  text: string;
}

export default function NotificationEndpointsCard({
  endpoints,
  canAdd,
  canUseWebhooks,
  requireHttps,
}: Props) {
  const t = useTranslations('settings.notifications');
  const tErrors = useTranslations('errors.server');
  const tAuth = useTranslations('errors.auth');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookLabel, setWebhookLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookFormError, setWebhookFormError] = useState<string | null>(null);
  const [webhookSubmitting, setWebhookSubmitting] = useState(false);

  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<TestMessage | null>(null);

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

  function resetWebhookForm() {
    setWebhookLabel('');
    setWebhookUrl('');
    setWebhookFormError(null);
  }

  // Only one add form is ever open at a time.
  function openNtfyForm() {
    setShowWebhookForm(false);
    setShowForm(true);
  }

  function openWebhookForm() {
    setShowForm(false);
    setShowWebhookForm(true);
  }

  async function readErrorMessage(response: Response): Promise<string> {
    const data: unknown = await response.json().catch(() => null);
    return isApiErrorBody(data) && data.error ? data.error : tErrors('internalError');
  }

  async function readAddErrorMessage(response: Response, type: EndpointType): Promise<string> {
    if (response.status === 403) {
      const data: unknown = await response.json().catch(() => null);
      const code = isApiErrorBody(data) ? data.code : undefined;
      if (code === 'forbidden') return t('webhookProOnly');
      return isApiErrorBody(data) && data.error ? data.error : tErrors('internalError');
    }
    if (response.status === 409) {
      const data: unknown = await response.json().catch(() => null);
      const code = isApiErrorBody(data) ? data.code : undefined;
      // Type-specific: the ntfy copy says "topic", which is not what a
      // webhook is, and this branch is reached by both.
      if (code === 'duplicate') {
        return type === 'WEBHOOK' ? t('webhookAddDuplicate') : t('endpointAddDuplicate');
      }
      return t('endpointLimit');
    }
    if (response.status === 400) {
      const data: unknown = await response.json().catch(() => null);
      const code = isApiErrorBody(data) ? data.code : undefined;
      if (code === 'dns') return t('endpointTestDns');
      if (code === 'policy') return t('endpointTestBlocked');
      // Both of these are rejections a user cannot diagnose by re-reading
      // their own URL, so the generic "check the URL and try again" fallback
      // is the worst possible message for them.
      if (code === 'credentials_in_url') {
        return type === 'WEBHOOK'
          ? t('webhookAddCredentialsInUrl')
          : t('endpointAddCredentialsInUrl');
      }
      if (code === 'not_ntfy') return t('endpointAddNotNtfy');
      return type === 'WEBHOOK' ? t('webhookAddInvalid') : t('endpointAddInvalid');
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
        setFormError(await readAddErrorMessage(response, 'NTFY'));
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

  async function handleAddWebhook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebhookFormError(null);
    setWebhookSubmitting(true);

    try {
      const response = await fetch('/api/notifications/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'WEBHOOK', label: webhookLabel, url: webhookUrl }),
      });

      if (!response.ok) {
        setWebhookFormError(await readAddErrorMessage(response, 'WEBHOOK'));
        return;
      }

      const data: unknown = await response.json().catch(() => null);
      const secret = extractSecret(data);

      resetWebhookForm();
      setShowWebhookForm(false);

      if (secret) {
        setNewWebhookSecret(secret);
      }

      router.refresh();
    } catch {
      setWebhookFormError(tErrors('internalError'));
    } finally {
      setWebhookSubmitting(false);
    }
  }

  function dismissWebhookSecret() {
    setNewWebhookSecret(null);
    setCopyResult(null);
  }

  async function handleCopySecret() {
    if (!newWebhookSecret) return;
    try {
      await navigator.clipboard.writeText(newWebhookSecret);
      setCopyResult({ ok: true, text: t('webhookSecretCopySuccess') });
    } catch {
      setCopyResult({ ok: false, text: t('webhookSecretCopyFailed') });
    }
  }

  async function handleTest(id: string) {
    const type = endpoints.find((endpoint) => endpoint.id === id)?.type ?? 'NTFY';

    setBusy(id, true);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    try {
      const response = await fetch(`/api/notifications/endpoints/${id}/test`, { method: 'POST' });

      if (response.status === 401) {
        setTestResults((prev) => ({ ...prev, [id]: { ok: false, text: tAuth('sessionExpired') } }));
        return;
      }

      if (response.status === 403) {
        const data: unknown = await response.json().catch(() => null);
        const code = isApiErrorBody(data) ? data.code : undefined;
        setTestResults((prev) => ({
          ...prev,
          [id]: {
            ok: false,
            text: code === 'forbidden' ? t('webhookProOnly') : tErrors('internalError'),
          },
        }));
        return;
      }

      if (response.status === 404) {
        setTestResults((prev) => ({
          ...prev,
          [id]: { ok: false, text: t('endpointTestNotFound') },
        }));
        return;
      }

      if (response.status === 429) {
        setTestResults((prev) => ({
          ...prev,
          [id]: { ok: false, text: t('endpointAddRateLimited') },
        }));
        return;
      }

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isTestOutcome(data)) {
        setTestResults((prev) => ({
          ...prev,
          [id]: { ok: false, text: t('endpointTestFailed') },
        }));
        return;
      }

      if (data.ok) {
        setTestResults((prev) => ({ ...prev, [id]: { ok: true, text: t('endpointTestOk') } }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [id]: { ok: false, text: t(messageKeyForOutboundCode(data.code, 'saved', type)) },
        }));
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, text: t('endpointTestFailed') } }));
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
  const ntfyEndpoints = endpoints.filter((e) => e.type === 'NTFY');
  const webhookEndpoints = endpoints.filter((e) => e.type === 'WEBHOOK');

  function renderEndpointItem(endpoint: NotificationEndpointSummary) {
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
            {result.text}
          </p>
        )}

        {!endpoint.enabled && (
          <div className="mt-2 flex items-center justify-between gap-4 rounded-md bg-muted/20 px-3 py-2">
            <div>
              <p className="text-sm text-muted">
                {endpoint.autoDisabledAt ? t('endpointDisabled') : t('endpointDisabledManual')}
              </p>
              {endpoint.autoDisabledAt && endpoint.lastFailureCode && (
                <p className="text-sm text-muted">
                  {t(messageKeyForOutboundCode(endpoint.lastFailureCode, 'saved', endpoint.type))}
                </p>
              )}
            </div>
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
  }

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">{t('endpointsTitle')}</h2>
      <p className="text-muted mb-6">{t('endpointsDescription')}</p>

      {!canAdd && <p className="text-sm text-muted mb-4">{t('endpointLimit')}</p>}

      <section className="mb-8">
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-1.5">
          {t('endpointTypeNtfy')}
          <TooltipIcon tooltip={t('ntfyTooltip')} />
        </h3>

        {ntfyEndpoints.length === 0 ? (
          <p className="text-sm text-muted mb-3">{t('ntfyNone')}</p>
        ) : (
          <ul className="space-y-4 mb-3">{ntfyEndpoints.map(renderEndpointItem)}</ul>
        )}

        {canAdd && (
          <>
            {!showForm && (
              <button
                type="button"
                onClick={openNtfyForm}
                className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
              >
                {t('endpointAdd')}
              </button>
            )}

            {showForm && (
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
                  <p id="endpoint-url-hint" className="text-xs text-muted mt-1">
                    {t('endpointUrlHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-foreground mb-1" htmlFor="endpoint-token">
                    {t('endpointToken')}
                  </label>
                  {/* type="password" so a token is never left visible on screen */}
                  <input
                    id="endpoint-token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    autoComplete="off"
                    maxLength={255}
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
                    className="px-3 py-1 rounded-md bg-primary text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
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
          </>
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3 flex items-center gap-1.5">
          {t('webhookSectionTitle')}
          <TooltipIcon tooltip={t('webhookTooltip')} />
        </h3>

        {webhookEndpoints.length === 0 ? (
          <p className="text-sm text-muted mb-3">{t('webhookNone')}</p>
        ) : (
          <ul className="space-y-4 mb-3">{webhookEndpoints.map(renderEndpointItem)}</ul>
        )}

        {canAdd ? (
          canUseWebhooks ? (
            <>
              {!showWebhookForm && (
                <button
                  type="button"
                  onClick={openWebhookForm}
                  className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
                >
                  {t('webhookAdd')}
                </button>
              )}

              {showWebhookForm && (
                <form onSubmit={(event) => void handleAddWebhook(event)} className="space-y-3">
                  <div>
                    <label className="block text-sm text-foreground mb-1" htmlFor="webhook-label">
                      {t('endpointLabel')}
                    </label>
                    <input
                      id="webhook-label"
                      type="text"
                      value={webhookLabel}
                      onChange={(event) => setWebhookLabel(event.target.value)}
                      required
                      maxLength={60}
                      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-foreground ${FOCUS_RING}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-foreground mb-1" htmlFor="webhook-url">
                      {t('webhookUrl')}
                    </label>
                    <input
                      id="webhook-url"
                      type="url"
                      value={webhookUrl}
                      onChange={(event) => setWebhookUrl(event.target.value)}
                      required
                      maxLength={500}
                      aria-describedby="webhook-url-hint"
                      className={`w-full rounded-md border border-border bg-background px-3 py-2 text-foreground ${FOCUS_RING}`}
                    />
                    <p id="webhook-url-hint" className="text-xs text-muted mt-1">
                      {requireHttps ? t('webhookUrlHint') : t('webhookUrlHintHttpAllowed')}
                    </p>
                  </div>

                  <p className="text-xs text-muted">{t('webhookPrivacyNote')}</p>

                  {webhookFormError && (
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                      {webhookFormError}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={webhookSubmitting}
                      className="px-3 py-1 rounded-md bg-primary text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                    >
                      {t('endpointSave')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowWebhookForm(false);
                        resetWebhookForm();
                      }}
                      className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
                    >
                      {t('endpointCancel')}
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              {t('webhookProOnly')}{' '}
              <Link href="/settings/billing" className="text-primary hover:text-primary-dark underline">
                {t('upgradePlan')}
              </Link>
            </p>
          )
        ) : null}
      </section>

      {newWebhookSecret && (
        <Modal
          isOpen={true}
          onClose={dismissWebhookSecret}
          title={t('webhookSecretTitle')}
          closeAriaLabel={tCommon('close')}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted">{t('webhookSecretBody')}</p>
            <input
              type="text"
              readOnly
              value={newWebhookSecret}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t('webhookSecretTitle')}
              className={`block w-full px-3 py-2 rounded bg-background border border-border text-foreground text-sm font-mono ${FOCUS_RING}`}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopySecret()}
                className={`px-3 py-1 rounded-md border border-border ${FOCUS_RING}`}
              >
                {t('webhookSecretCopy')}
              </button>
              <button
                type="button"
                onClick={dismissWebhookSecret}
                className="px-3 py-1 rounded-md bg-primary text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                {t('webhookSecretDone')}
              </button>
            </div>
            <p
              role="status"
              className={`text-sm ${copyResult?.ok === false ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}
            >
              {copyResult?.text}
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
