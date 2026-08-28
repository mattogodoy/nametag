'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
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
   * `outboundPolicy().requireHttps`, which is true only in SaaS mode: a
   * self-hosted instance accepts plain http, and the hint text below must not
   * tell a self-hoster their working configuration is invalid.
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

/**
 * `POST /api/notifications/endpoints` only ever includes `secret` on a
 * successful WEBHOOK creation, and only that one time. Narrowed here rather
 * than trusted as `any` so a malformed or absent field just yields `null`.
 */
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
};

type MessageContext = 'form' | 'saved';

/**
 * `data.code` crosses a network boundary as a plain string and could be
 * anything, so it cannot be typed as OutboundFailureCode at the point it is
 * read. The cast below only ever feeds a lookup that falls back safely when
 * the key is absent, so an unrecognised value degrades to the generic
 * message rather than producing a wrong one.
 *
 * Only `http_4xx` needs webhook-specific copy: the ntfy wording says "check
 * the topic name and the access token", which makes no sense for a webhook,
 * which has neither, only a signing secret it never sends anywhere. Every
 * other code in the two maps above, including `redirect`, is already
 * channel-neutral wording that fits both destination types, so nothing else
 * branches on `type` here.
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

  // The signing secret of a webhook just created. This is the ONLY place it
  // ever lives client-side: the create response carries it exactly once, the
  // list of endpoints passed down as props never includes it (the API never
  // selects it back out, see PUBLIC_FIELDS on the server), and dismissing the
  // dialog below sets this back to null rather than, say, remembering it for
  // "show again". There is nowhere to fetch it back from.
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  // Feedback for the Copy button inside the secret dialog. Distinct from
  // testResults below: this is about whether the copy itself worked, not
  // about a destination's reachability, and it needs to say so visibly, not
  // just silently succeed or silently do nothing. `role="status"` (rather
  // than the `role="alert"` used elsewhere in this file) because this is a
  // polite confirmation, not an interruption, even in its failure form: the
  // secret stays on screen either way.
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

  // Only one add form is ever open at a time. Besides being the simpler
  // affordance, it also keeps the two forms' "Name" fields from ever
  // existing in the DOM together.
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

  /**
   * The create endpoint returns brand new, English-only error strings for its
   * 400/403/409/429 responses. Those are new user-facing text, so unlike
   * readErrorMessage (which surfaces an existing house-pattern string for
   * actions that were already shipped, and rarely fires), this branches on
   * the HTTP status to show a translated message for the cases a user will
   * actually hit.
   *
   * The 403 case is checked first, before the type-specific branches below,
   * since a 403 short-circuits before any of that logic matters. But 403 is
   * not only the Pro entitlement gate: withAuth returns the same status for
   * an invalid request origin and for a read-only API token used on a
   * mutating request, neither of which has anything to do with destination
   * type or billing. Only the entitlement failure carries `code: 'forbidden'`
   * in its body, so that code, not the bare status, is what selects the
   * upsell message; anything else falls back to the server's own message
   * like every other unmapped case.
   *
   * The 400 case carries its own machine-readable `code` from the route
   * (`policy`, `dns`, or `invalid`), and that distinction matters here for
   * exactly the same reason it matters on the test-send path: `policy` is a
   * permanent refusal, the user must change the URL, while `dns` can be a
   * transient resolver hiccup on an otherwise-correct URL. Reusing
   * endpointTestBlocked / endpointTestDns keeps that contrast intact without
   * new locale keys, since the wording already fits either screen. The
   * generic `invalid` fallback is the one case that is channel-specific
   * wording ("check the topic URL"), so it branches on `type`.
   *
   * The 409 case also carries a `code`, distinguishing the per-user cap
   * (`undefined`, the original 409 before duplicates existed) from the same
   * URL already being registered (`duplicate`, from the `@@unique([userId,
   * url])` constraint). The two are unrelated problems with unrelated fixes:
   * the first needs the user to remove another destination, the second needs
   * a different URL.
   *
   * Anything else still falls back to the raw body, so a genuinely unexpected
   * server message is surfaced rather than swallowed.
   */
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
      if (code === 'duplicate') return t('endpointAddDuplicate');
      return t('endpointLimit');
    }
    if (response.status === 400) {
      const data: unknown = await response.json().catch(() => null);
      const code = isApiErrorBody(data) ? data.code : undefined;
      if (code === 'dns') return t('endpointTestDns');
      if (code === 'policy') return t('endpointTestBlocked');
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

      // Read the secret out of this one response before anything else
      // touches state. It is never stored under the endpoint list, never
      // logged, and the API will not hand it back again after this.
      const data: unknown = await response.json().catch(() => null);
      const secret = extractSecret(data);

      resetWebhookForm();
      setShowWebhookForm(false);

      // Put the secret in state before refreshing the route. router.refresh()
      // re-renders this component with the new endpoint list from the
      // server, and nothing in that re-render may run before the one and
      // only copy of this secret is already committed to state: a refresh
      // that somehow unmounted or reset this component ahead of the state
      // update would lose it for good.
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
    // The only place this value lives. Once dismissed, whether by the "I
    // saved it" button, the modal's close button, Escape, or a click
    // outside, it is gone: there is no way to read it back, so a user who
    // did not copy it has to remove this destination and create a new one.
    setNewWebhookSecret(null);
    setCopyResult(null);
  }

  async function handleCopySecret() {
    if (!newWebhookSecret) return;
    try {
      await navigator.clipboard.writeText(newWebhookSecret);
      setCopyResult({ ok: true, text: t('webhookSecretCopySuccess') });
    } catch {
      // Clipboard can fail for reasons the user cannot see: a plain-http
      // self-hosted instance leaves `navigator.clipboard` undefined
      // entirely, and some browsers deny the permission outright. A silent
      // catch here reads as success, and this dialog is the only chance to
      // ever see this secret again: staying quiet risks the user believing
      // it is safely copied, dismissing the dialog, and losing it for good.
      // The text is still visible and selectable above for a manual copy.
      setCopyResult({ ok: false, text: t('webhookSecretCopyFailed') });
    }
  }

  /**
   * `response.status` is checked before the body is parsed, and before the
   * generic !response.ok fallback, for the same reason readAddErrorMessage
   * checks status on the create path: `checkRateLimit` on this route returns
   * a bare 429 with no `OutboundFailureCode`, and folding it into the
   * generic !response.ok branch below reports our own rate limiter as the
   * destination being unreachable, which is wrong (nothing was even
   * attempted) and actively counterproductive (retrying immediately hits the
   * same limit again). 401 gets the same early, distinct treatment: a session
   * that expired mid-visit is not the destination's fault either.
   *
   * 403 is not so simple: withAuth returns the same status for an invalid
   * request origin and for a read-only API token, neither of which is the
   * Pro entitlement gate and neither of which is specific to a webhook. Only
   * the entitlement failure carries `code: 'forbidden'` in its body (see the
   * route), so the body is read and that code, not the bare status, decides
   * whether the upsell message is shown. Anything else at 403 falls back to
   * the generic failure message rather than telling an ntfy destination it
   * is gated behind Pro.
   *
   * 404 also gets its own branch: it means the row is gone, most likely
   * deleted from another tab, not that the destination failed to respond.
   * There is nothing to retry, so the generic "it may be temporary" wording
   * would be actively misleading here.
   */
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

      // A downgrade re-checked at send time (see the route) is reported with
      // `code: 'forbidden'` in the body. Anything else at 403 (an invalid
      // request origin, a read-only API token) is neither the destination's
      // fault nor something a retry can fix, but it also has nothing to do
      // with Pro, so it must not show the upsell message either.
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
                    <p className="text-foreground font-medium truncate">
                      {endpoint.label}
                      {/* A translated label, not the raw enum: rendering
                          "NTFY" / "WEBHOOK" in capitals would be an
                          untranslated string, and would render ntfy's own
                          name wrong (the product spells itself lowercase). */}
                      <span className="ml-2 align-middle inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-primary/10 text-primary">
                        {endpoint.type === 'WEBHOOK' ? t('endpointTypeWebhook') : t('endpointTypeNtfy')}
                      </span>
                    </p>
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

                {/* Gated on `enabled`, not `autoDisabledAt`, for whether the
                    banner shows at all: a row can be disabled without that
                    timestamp (a plain PUT), and such a row must still be
                    visible and recoverable here. `autoDisabledAt` itself then
                    decides which of the two reasons is shown: auto-disable
                    always sets `enabled: false` and `autoDisabledAt` together
                    (see recordEndpointResult), and a plain PUT never sets
                    `autoDisabledAt`, so its presence reliably tells the two
                    apart. */}
                {!endpoint.enabled && (
                  <div className="mt-2 flex items-center justify-between gap-4 rounded-md bg-muted/20 px-3 py-2">
                    <div>
                      <p className="text-sm text-muted">
                        {endpoint.autoDisabledAt ? t('endpointDisabled') : t('endpointDisabledManual')}
                      </p>
                      {/* The coarse failure code, run through the same
                          code-to-message mapping the test-send result uses.
                          Never the raw code itself: see messageKeyForOutboundCode.
                          Only shown for an auto-disabled row: a manually
                          disabled one may carry a stale code from an
                          unrelated earlier failure that has nothing to do
                          with why it is off right now. */}
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
          })}
        </ul>
      )}

      {!canAdd && <p className="text-sm text-muted mb-4">{t('endpointLimit')}</p>}

      {canAdd && (
        <div className="space-y-4">
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
                  // Not the shared FOCUS_RING: that ring is the same color as this
                  // button's own bg-primary fill, so without ring-offset-2 the
                  // focus indicator is invisible against its own background. The
                  // house pattern for a filled primary button (see EmptyState,
                  // GoogleSignInButton) always adds the offset.
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

          {canUseWebhooks ? (
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

                  {/* The app's data-privacy posture applied to a feature that
                      sends contact names off the instance: shown at the
                      moment of the decision, before the submit button, not
                      buried in docs. */}
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
          )}
        </div>
      )}

      {newWebhookSecret && (
        <Modal
          isOpen={true}
          onClose={dismissWebhookSecret}
          title={t('webhookSecretTitle')}
          closeAriaLabel={tCommon('close')}
        >
          <div className="space-y-3">
            {/* Says plainly that this is the only chance to see it: a user
                who dismisses this without copying has to delete the webhook
                and create a new one, since there is no endpoint that reads
                the secret back out. */}
            <p className="text-sm text-muted">{t('webhookSecretBody')}</p>
            {/* A readonly input, not a <code> block: an input is reachable by
                Tab and supports the platform's native select-all shortcut
                once focused, so a keyboard user can select and copy this the
                same way a mouse user can triple-click it. The onFocus
                handler selects the value immediately so tabbing to it is
                enough, with no extra shortcut to discover. */}
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
            {/* Always mounted, even before there is anything to say. A live
                region only reliably gets announced when its content changes
                after it is already in the DOM: mounting the element and its
                text together, as a conditional render would, is not
                guaranteed to be picked up by assistive tech at all. */}
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
