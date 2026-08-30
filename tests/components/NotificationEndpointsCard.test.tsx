import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';

// vi.mock factories are hoisted above every other statement in the file,
// including plain const declarations, so the mock functions they reference
// have to be created through vi.hoisted rather than assigned normally.
const { mockRefresh, mockToastError } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: mockToastError,
  },
}));

import messages from '../../locales/en.json';
import NotificationEndpointsCard, {
  type NotificationEndpointSummary,
} from '../../components/NotificationEndpointsCard';

function renderCard(props: Partial<ComponentProps<typeof NotificationEndpointsCard>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationEndpointsCard
        endpoints={[]}
        canAdd={true}
        canUseWebhooks={true}
        requireHttps={true}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body } as Response;
}

function openAddFormAndFill(label: string, url: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: label } });
  fireEvent.change(screen.getByLabelText('Topic URL'), { target: { value: url } });
}

function openWebhookFormAndFill(label: string, url: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: label } });
  fireEvent.change(screen.getByLabelText('Endpoint URL'), { target: { value: url } });
}

const endpoint: NotificationEndpointSummary = {
  id: 'ep-1',
  type: 'NTFY',
  label: 'My phone',
  url: 'https://ntfy.sh/my-topic',
  enabled: true,
  lastFailureCode: null,
  autoDisabledAt: null,
};

describe('NotificationEndpointsCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('says so when there are no destinations yet', () => {
    renderCard({ endpoints: [] });

    expect(screen.getByText('No topics yet.')).toBeTruthy();
    expect(screen.getByText('No webhooks yet.')).toBeTruthy();
  });

  it('hides the add form and shows the limit message when canAdd is false', () => {
    renderCard({ canAdd: false });

    expect(screen.queryByRole('button', { name: 'Add ntfy topic' })).not.toBeInTheDocument();
    expect(
      screen.getByText('You have reached the maximum number of destinations.')
    ).toBeInTheDocument();
  });

  it('shows the add form when canAdd is true', () => {
    renderCard({ canAdd: true });

    expect(screen.getByRole('button', { name: 'Add ntfy topic' })).toBeInTheDocument();
    expect(
      screen.queryByText('You have reached the maximum number of destinations.')
    ).not.toBeInTheDocument();
  });

  it('gives the filled Save button a focus ring offset so its ring is visible against its own fill', () => {
    // The shared FOCUS_RING helper is the same color as bg-primary, so
    // without ring-offset-2 the ring would be invisible on this button, the
    // one place in this card that uses a filled primary background.
    renderCard({ canAdd: true });
    fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton.className).toContain('focus:ring-offset-2');
  });

  it('surfaces the success message for a successful test send', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({ endpoints: [endpoint] });

    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

    await waitFor(() => {
      expect(screen.getByText('Test notification sent.')).toBeInTheDocument();
    });
    // Pins the URL and method: sending to the wrong endpoint or with the
    // wrong verb would still show a success message from this fixture alone.
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/endpoints/ep-1/test', {
      method: 'POST',
    });
  });

  describe('failure code mapping', () => {
    it.each([
      // blocked/http_4xx get the saved-row variant here: the test button only
      // ever appears against an already-saved destination, whose URL and
      // token cannot be edited in place, so the message must point at the
      // action that actually exists (remove and re-add).
      [
        'blocked',
        'That URL cannot be used. Remove this destination and add it again with a working URL.',
      ],
      ['dns', 'That hostname did not resolve. Check the spelling, or try again in a moment.'],
      [
        'http_4xx',
        'The destination rejected the notification. Remove this destination and add it again with the correct topic and access token.',
      ],
      ['http_429', 'The destination is rate limiting us. It should recover on its own.'],
      [
        'tls',
        "The destination's certificate could not be verified. If it is on your own network, this is often a self-signed certificate that needs to be trusted or replaced.",
      ],
      // redirect gets the saved-row variant too, for the same reason as
      // blocked/http_4xx above: the test button only appears against an
      // already-saved destination, so the message must not tell the user to
      // edit a URL that cannot be edited in place.
      [
        'redirect',
        'That address redirects to a different location, which is not supported. Remove this destination and add it again with a URL that does not redirect.',
      ],
    ])('maps the %s code to its own message', async (code, expected) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, code })));
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(screen.getByText(expected)).toBeInTheDocument();
      });
      // The raw code must never be rendered, only branched on.
      expect(screen.queryByText(code)).not.toBeInTheDocument();
    });

    it('falls back to the generic retry message for an unlisted code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ ok: false, code: 'timeout' }))
      );
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Could not reach that destination. It may be temporary, so it is worth trying again.'
          )
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('timeout')).not.toBeInTheDocument();
    });

    it('falls back to the generic retry message when the test request itself fails', async () => {
      // The body is a well-formed { ok: false, code } that WOULD map to a
      // specific message if the !response.ok guard were ever removed, so
      // this only stays green if that guard is actually checked first.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ ok: false, code: 'blocked' }, false, 500))
      );
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Could not reach that destination. It may be temporary, so it is worth trying again.'
          )
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText(
          'That URL cannot be used. Remove this destination and add it again with a working URL.'
        )
      ).not.toBeInTheDocument();
    });

    it('reports our own rate limit as rate limiting, not as the destination being unreachable', async () => {
      // checkRateLimit on the test-send route returns a bare 429 with no
      // OutboundFailureCode body: nothing was even attempted, so this must
      // not read as "could not reach that destination".
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 429)));
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText('Too many attempts. Wait a few minutes and try again.')
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText(
          'Could not reach that destination. It may be temporary, so it is worth trying again.'
        )
      ).not.toBeInTheDocument();
    });

    it('reports an expired session distinctly from the destination being unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 401)));
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText('Your session has expired. Please log in again.')
        ).toBeInTheDocument();
      });
    });
  });

  it('renders the auto-disabled banner with a re-enable action', () => {
    renderCard({
      endpoints: [{ ...endpoint, enabled: false, autoDisabledAt: '2026-08-01T00:00:00.000Z' }],
    });

    expect(
      screen.getByText('Turned off after repeated failures. Fix the destination, then turn it back on.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn back on' })).toBeInTheDocument();
  });

  it('does not render the auto-disabled banner for an enabled endpoint', () => {
    renderCard({ endpoints: [endpoint] });

    expect(screen.queryByRole('button', { name: 'Turn back on' })).not.toBeInTheDocument();
  });

  it('shows a manual-disable message, not the auto-disable one, for a disabled endpoint without autoDisabledAt set', () => {
    // The only way to reach enabled:false with autoDisabledAt:null is a plain
    // PUT {enabled:false}: auto-disable always sets both together (see
    // recordEndpointResult), and success never touches either. So this state
    // is manual disable, and must say so rather than blaming failures that
    // were not why the destination is off.
    renderCard({
      endpoints: [{ ...endpoint, enabled: false, autoDisabledAt: null }],
    });

    expect(
      screen.getByText('Turned off. Turn it back on when you want reminders here again.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Turned off after repeated failures. Fix the destination, then turn it back on.')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn back on' })).toBeInTheDocument();
  });

  it('renders the mapped reason for the last failure, never the raw code', () => {
    renderCard({
      endpoints: [
        { ...endpoint, enabled: false, autoDisabledAt: '2026-08-01T00:00:00.000Z', lastFailureCode: 'dns' },
      ],
    });

    expect(
      screen.getByText('That hostname did not resolve. Check the spelling, or try again in a moment.')
    ).toBeInTheDocument();
    expect(screen.queryByText('dns')).not.toBeInTheDocument();
  });

  it('does not show a failure reason next to a manually disabled endpoint, even if a stale code is present', () => {
    // A manually disabled row may carry a lastFailureCode left over from an
    // unrelated earlier failure. Showing it next to "turned off manually"
    // would misattribute why the destination is off right now.
    renderCard({
      endpoints: [{ ...endpoint, enabled: false, autoDisabledAt: null, lastFailureCode: 'dns' }],
    });

    expect(
      screen.queryByText('That hostname did not resolve. Check the spelling, or try again in a moment.')
    ).not.toBeInTheDocument();
  });

  it('re-enables a disabled endpoint via PUT and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({
      endpoints: [{ ...endpoint, enabled: false, autoDisabledAt: '2026-08-01T00:00:00.000Z' }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Turn back on' }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/endpoints/ep-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
  });

  it('removes an endpoint via DELETE and refreshes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({ endpoints: [endpoint] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/endpoints/ep-1', {
      method: 'DELETE',
    });
  });

  it('shows a toast and does not refresh when removal fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Something went wrong' }, false));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({ endpoints: [endpoint] });

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Something went wrong');
    });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('submits the token in the create request but never renders it, and clears it when the form reopens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' } }, true, 201));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({ endpoints: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));

    const tokenInput = screen.getByLabelText('Access token (optional)') as HTMLInputElement;
    expect(tokenInput.type).toBe('password');
    // Matches createNtfyEndpointSchema's token max length (255). Without
    // this, an over-length token produces a server error naming a field the
    // user cannot see, since the label and URL inputs already cap input but
    // the token one previously did not.
    expect(tokenInput.maxLength).toBe(255);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My phone' } });
    fireEvent.change(screen.getByLabelText('Topic URL'), {
      target: { value: 'https://ntfy.sh/my-topic' },
    });
    fireEvent.change(tokenInput, { target: { value: 'tk_secret_value' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });

    // Pins the exact request: URL, method, and a body that actually carries
    // type: 'NTFY' and the token, so a wrong type, a dropped field, or a
    // request to the wrong URL fails this test instead of leaving it green.
    expect(fetchMock).toHaveBeenCalledWith('/api/notifications/endpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'NTFY',
        label: 'My phone',
        url: 'https://ntfy.sh/my-topic',
        token: 'tk_secret_value',
      }),
    });

    // The token travelled in the request body above, never as visible text.
    expect(screen.queryByText('tk_secret_value')).not.toBeInTheDocument();

    // The form was hidden after the successful save. Reopening it must not
    // remember the token that was just submitted.
    fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));
    const reopenedTokenInput = screen.getByLabelText('Access token (optional)') as HTMLInputElement;
    expect(reopenedTokenInput.value).toBe('');
  });

  describe('create failure mapping', () => {
    it('shows the translated limit message for a 409, not the raw response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ error: 'You can have at most 5 endpoints' }, false, 409))
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText('You have reached the maximum number of destinations.')
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('You can have at most 5 endpoints')).not.toBeInTheDocument();
    });

    it('shows a distinct message for a 409 coded "duplicate", not the per-user cap message', async () => {
      // The cap message and the duplicate message are unrelated problems
      // with unrelated fixes: this only stays green if the two 409s are
      // told apart by `code` rather than collapsed into one.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(
            { error: 'You have already added that destination', code: 'duplicate' },
            false,
            409
          )
        )
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('You have already added that topic.')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('You have reached the maximum number of destinations.')
      ).not.toBeInTheDocument();
    });

    it('shows the translated invalid-URL message for a 400 coded "invalid", not the raw response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(
            {
              error: 'Enter a full ntfy topic URL, for example https://ntfy.sh/my-topic',
              code: 'invalid',
            },
            false,
            400
          )
        )
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Check the topic URL and try again.')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Enter a full ntfy topic URL, for example https://ntfy.sh/my-topic')
      ).not.toBeInTheDocument();
    });

    it('shows the DNS message for a 400 coded "dns", not the URL-blaming message', async () => {
      // The distinction this pins: a resolver hiccup on an otherwise-correct
      // URL must not be told to the user as "change your URL".
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({ error: 'That URL cannot be used', code: 'dns' }, false, 400)
        )
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'That hostname did not resolve. Check the spelling, or try again in a moment.'
          )
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('Check the topic URL and try again.')).not.toBeInTheDocument();
    });

    it('shows the blocked message for a 400 coded "policy"', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({ error: 'That URL cannot be used', code: 'policy' }, false, 400)
        )
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText('That URL cannot be used. Change it and save again.')
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('Check the topic URL and try again.')).not.toBeInTheDocument();
    });

    it('shows the translated rate-limit message for a 429', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ error: 'Too many attempts.' }, false, 429))
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(
          screen.getByText('Too many attempts. Wait a few minutes and try again.')
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('Too many attempts.')).not.toBeInTheDocument();
    });

    it('still falls back to the raw response body for an unmapped status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ error: 'Something exploded' }, false, 500))
      );
      renderCard({ endpoints: [] });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Something exploded')).toBeInTheDocument();
      });
    });
  });

  describe('webhook destinations', () => {
    it('groups ntfy and webhook destinations under separate section headings', () => {
      renderCard({
        endpoints: [
          endpoint,
          { ...endpoint, id: 'ep-2', type: 'WEBHOOK', label: 'Home Assistant', url: 'https://hooks.test/x' },
        ],
      });

      const headings = screen.getAllByRole('heading', { level: 3 });
      const headingTexts = headings.map((h) => h.textContent);
      expect(headingTexts.some((text) => text?.includes('ntfy'))).toBe(true);
      expect(headingTexts.some((text) => text?.includes('Webhooks'))).toBe(true);
      // Never the raw enum as all-caps.
      expect(screen.queryByText('NTFY')).not.toBeInTheDocument();
      expect(screen.queryByText('WEBHOOK')).not.toBeInTheDocument();
    });

    it('shows the upsell instead of the webhook form when the user is not entitled, leaving no way to submit one', () => {
      // Bite-check: an implementation that shows the button (or the form)
      // regardless of entitlement makes both of these assertions fail.
      renderCard({ endpoints: [], canUseWebhooks: false });

      expect(screen.getByText('Outgoing webhooks are part of Pro.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Upgrade your plan' })).toHaveAttribute(
        'href',
        '/settings/billing'
      );
      expect(screen.queryByRole('button', { name: 'Add webhook' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Endpoint URL')).not.toBeInTheDocument();
    });

    it('does not show the upsell when the user is entitled', () => {
      renderCard({ endpoints: [], canUseWebhooks: true });

      expect(screen.queryByText('Outgoing webhooks are part of Pro.')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add webhook' })).toBeInTheDocument();
    });

    it('shows the data-privacy note in the webhook form before the submit button', () => {
      renderCard({ endpoints: [], canUseWebhooks: true });

      fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));

      expect(
        screen.getByText('Contact names are sent to this server. Only add an endpoint you control.')
      ).toBeInTheDocument();
    });

    it('posts a webhook creation request with type WEBHOOK, not NTFY', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret: 'a'.repeat(64) }, true, 201));
      vi.stubGlobal('fetch', fetchMock);
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/notifications/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WEBHOOK',
          label: 'Home Assistant',
          url: 'https://hooks.test/nametag',
        }),
      });
    });

    it('shows the secret exactly once after creating a webhook, and removes it from the DOM once dismissed', async () => {
      // Bite-check 1: an implementation that never surfaces `secret` from the
      // create response fails the first assertion. An implementation that
      // keeps the secret in state (or renders it a second time) after
      // dismissal fails the second.
      const secret = 'a'.repeat(64);
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201));
      vi.stubGlobal('fetch', fetchMock);
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByDisplayValue(secret)).toBeInTheDocument();
      });
      // The dialog says plainly this is the only chance to see it.
      expect(
        screen.getByText(
          'This is shown once. Use it to verify the X-Nametag-Signature header. If you lose it, remove the webhook and add it again.'
        )
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'I saved it' }));

      await waitFor(() => {
        expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
      });
    });

    it('renders the secret as an accessible dialog and moves focus into it', async () => {
      const secret = 'c'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');

      // Focus moves in an effect, which is a later tick than the one that puts
      // the dialog in the document. Asserting it synchronously passes on a fast
      // machine and loses the race on a slow one, so wait for it rather than
      // assuming the two happen together.
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it('closing the secret dialog via Escape also clears the secret from state, not only the button dismiss', async () => {
      const secret = 'd'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByDisplayValue(secret)).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByDisplayValue(secret)).not.toBeInTheDocument();
      });
    });

    it('mounts the copy-feedback status region before there is anything to announce', async () => {
      // A live region only reliably gets announced by assistive tech when its
      // content changes after it is already present in the DOM. Mounting the
      // role="status" element together with its first text, as a conditional
      // render would, is not guaranteed to be picked up at all. This pins
      // that the region exists up front, empty, rather than only appearing
      // once there is a message to show.
      const secret = 'd'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => screen.getByDisplayValue(secret));

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('copies the secret to the clipboard from the Copy button', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const secret = 'e'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => screen.getByDisplayValue(secret));

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(secret);
      });
      // A silent success is indistinguishable from the click doing nothing
      // at all, and this secret can never be fetched again once the dialog
      // closes: the confirmation has to be visible, not just the clipboard
      // write happening.
      await waitFor(() => {
        expect(screen.getByText('Copied to clipboard.')).toBeInTheDocument();
      });
    });

    it('shows a visible failure message when the clipboard write fails, instead of doing nothing', async () => {
      // Bite-check: an empty catch here makes the click a no-op on a
      // plain-http self-hosted instance (navigator.clipboard is undefined),
      // and the user believes the secret is copied when nothing happened.
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      });
      const secret = 'f'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => screen.getByDisplayValue(secret));

      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

      await waitFor(() => {
        expect(
          screen.getByText('Could not copy. Select the text above and copy it manually.')
        ).toBeInTheDocument();
      });
      // The secret must still be on screen: a failed copy is not a reason to
      // hide the only surface that still has it.
      expect(screen.getByDisplayValue(secret)).toBeInTheDocument();
    });

    it('lets a keyboard user select the secret text, not only a mouse user', async () => {
      const secret = 'g'.repeat(64);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' }, secret }, true, 201))
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const field = await screen.findByDisplayValue(secret);
      // A <code> block is not in the tab order and cannot be selected by
      // keyboard alone; a text input is both.
      expect(field.tagName).toBe('INPUT');
      expect((field as HTMLInputElement).readOnly).toBe(true);
    });

    it('shows the webhook-specific URL hint on self-hosted instances, where http is allowed', () => {
      renderCard({ endpoints: [], canUseWebhooks: true, requireHttps: false });

      fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));

      // Asserts the http-allowed hint is actually rendered, not just that the
      // https-required one is absent: rendering neither hint would also pass
      // the absence check alone.
      expect(
        screen.getByText('Must be an address that accepts a POST. HTTP is allowed on self-hosted instances.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Must be an https:// address that accepts a POST.')
      ).not.toBeInTheDocument();
    });

    it('shows the https-required hint in SaaS mode', () => {
      renderCard({ endpoints: [], canUseWebhooks: true, requireHttps: true });

      fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));

      expect(
        screen.getByText('Must be an https:// address that accepts a POST.')
      ).toBeInTheDocument();
    });

    it('maps a 403 creation response to the Pro upsell message, not the raw response body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(
            { error: 'Outgoing webhooks require a Pro subscription', code: 'forbidden' },
            false,
            403
          )
        )
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Outgoing webhooks are part of Pro.')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('Outgoing webhooks require a Pro subscription')
      ).not.toBeInTheDocument();
    });

    it('does not show the Pro upsell for an ntfy creation request that gets a 403 for an unrelated reason', async () => {
      // withAuth returns 403 for an invalid request origin regardless of
      // destination type; an ntfy add has no entitlement gate at all, so this
      // must never render the webhook upsell message.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ error: 'Invalid request origin' }, false, 403))
      );
      renderCard({ endpoints: [], canAdd: true });

      openAddFormAndFill('My phone', 'https://ntfy.sh/my-topic');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Invalid request origin')).toBeInTheDocument();
      });
      expect(screen.queryByText('Outgoing webhooks are part of Pro.')).not.toBeInTheDocument();
    });

    it('shows webhook-specific wording for a generic 400, not the ntfy topic-URL wording', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse({ error: 'Invalid endpoint', code: 'invalid' }, false, 400)
        )
      );
      renderCard({ endpoints: [], canUseWebhooks: true });

      openWebhookFormAndFill('Home Assistant', 'https://hooks.test/nametag');
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(screen.getByText('Check the webhook URL and try again.')).toBeInTheDocument();
      });
      expect(screen.queryByText('Check the topic URL and try again.')).not.toBeInTheDocument();
    });

    it('shows webhook-specific wording for a rejected test-send, not the ntfy topic/token wording', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, code: 'http_4xx' })));
      renderCard({
        endpoints: [{ ...endpoint, id: 'ep-2', type: 'WEBHOOK', url: 'https://hooks.test/x' }],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "The destination rejected the notification. This is usually an authentication, payload, or signature problem, not the URL. Check your receiver's logs, and if you need a new signing secret, remove this destination and add it again."
          )
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText(
          'The destination rejected the notification. Remove this destination and add it again with the correct topic and access token.'
        )
      ).not.toBeInTheDocument();
    });

    it('still shows the ntfy-specific rejected wording for an ntfy destination, unchanged', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, code: 'http_4xx' })));
      renderCard({ endpoints: [{ ...endpoint, type: 'NTFY' }] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'The destination rejected the notification. Remove this destination and add it again with the correct topic and access token.'
          )
        ).toBeInTheDocument();
      });
    });

    it('uses the same redirect message for a webhook as for an ntfy destination, since the wording is already channel-neutral', async () => {
      // There is no webhookTestRedirectSaved key: it used to be byte-identical
      // to endpointTestRedirectSaved, so the redirect code no longer branches
      // on destination type at all (see messageKeyForOutboundCode). This test
      // pins that a webhook and an ntfy destination render the exact same
      // string for the same code, so a regression that reintroduces separate,
      // diverging wording for one of them would be caught here.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: false, code: 'redirect' })));
      renderCard({
        endpoints: [{ ...endpoint, id: 'ep-2', type: 'WEBHOOK', url: 'https://hooks.test/x' }],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      const sharedMessage =
        'That address redirects to a different location, which is not supported. Remove this destination and add it again with a URL that does not redirect.';

      await waitFor(() => {
        expect(screen.getByText(sharedMessage)).toBeInTheDocument();
      });
      expect(screen.queryByText(/topic URL/)).not.toBeInTheDocument();
    });

    it('tells a lapsed Pro subscriber their subscription lapsed, not that the destination is unreachable', async () => {
      // Bite-check: falling 403 through to the generic !response.ok branch
      // would show "Could not reach that destination. It may be temporary,
      // so it is worth trying again," which is false on every count: it is
      // not a reachability problem, it is not temporary, and retrying can
      // never succeed until the subscription is restored.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          jsonResponse(
            { error: 'Outgoing webhooks require a Pro subscription', code: 'forbidden' },
            false,
            403
          )
        )
      );
      renderCard({
        endpoints: [{ ...endpoint, id: 'ep-2', type: 'WEBHOOK', url: 'https://hooks.test/x' }],
      });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(screen.getByText('Outgoing webhooks are part of Pro.')).toBeInTheDocument();
      });
      expect(
        screen.queryByText(
          'Could not reach that destination. It may be temporary, so it is worth trying again.'
        )
      ).not.toBeInTheDocument();
    });

    it('does not show the Pro upsell for a 403 that is not the entitlement gate, such as an ntfy destination hitting an origin-validation failure', async () => {
      // withAuth returns 403 for an invalid request origin or a read-only API
      // token too, neither of which is the Pro entitlement gate and neither of
      // which has anything to do with destination type. Only the entitlement
      // failure carries code: 'forbidden'; this body deliberately omits it.
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ error: 'Invalid request origin' }, false, 403))
      );
      renderCard({ endpoints: [{ ...endpoint, type: 'NTFY' }] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(screen.getByText('Something went wrong. Please try again later.')).toBeInTheDocument();
      });
      expect(screen.queryByText('Outgoing webhooks are part of Pro.')).not.toBeInTheDocument();
    });

    it('reports a removed destination distinctly from an unreachable one', async () => {
      // A 404 means the row is gone, most likely deleted in another tab, not
      // that the destination failed to respond. Retrying can never succeed.
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Not found' }, false, 404)));
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText('This destination no longer exists. It may have been removed in a different tab.')
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByText(
          'Could not reach that destination. It may be temporary, so it is worth trying again.'
        )
      ).not.toBeInTheDocument();
    });

    it('opening the webhook form closes an already-open ntfy form, so their Name fields never coexist', () => {
      renderCard({ endpoints: [], canUseWebhooks: true });

      fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));
      expect(screen.getByLabelText('Topic URL')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Add webhook' }));

      expect(screen.queryByLabelText('Topic URL')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Endpoint URL')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Name')).toHaveLength(1);
    });
  });
});

describe('lapsed webhook entitlement', () => {
  it('says a webhook is no longer being delivered to when the subscription has lapsed', () => {
    // The entitlement is re-checked every run rather than cached on the row,
    // so delivery stops correctly and immediately. Nothing told the user: a
    // skip is not a failure, so consecutiveFailures never increments and the
    // destination never auto-disables. It renders as enabled and healthy
    // indefinitely while sending nothing.
    renderCard({
      endpoints: [
        {
          id: 'ep-1',
          type: 'WEBHOOK',
          label: 'My receiver',
          url: 'https://hooks.example.com/abc',
          enabled: true,
          lastFailureCode: null,
          autoDisabledAt: null,
        },
      ],
      canUseWebhooks: false,
    });

    expect(screen.getByText(/need an active Pro subscription/i)).toBeInTheDocument();
  });

  it('says nothing when the subscription is active', () => {
    renderCard({
      endpoints: [
        {
          id: 'ep-1',
          type: 'WEBHOOK',
          label: 'My receiver',
          url: 'https://hooks.example.com/abc',
          enabled: true,
          lastFailureCode: null,
          autoDisabledAt: null,
        },
      ],
      canUseWebhooks: true,
    });

    expect(screen.queryByText(/need an active Pro subscription/i)).toBeNull();
  });

  it('says nothing for an ntfy destination, which needs no entitlement', () => {
    renderCard({
      endpoints: [
        {
          id: 'ep-1',
          type: 'NTFY',
          label: 'Phone',
          url: 'https://ntfy.sh/my-topic',
          enabled: true,
          lastFailureCode: null,
          autoDisabledAt: null,
        },
      ],
      canUseWebhooks: false,
    });

    expect(screen.queryByText(/need an active Pro subscription/i)).toBeNull();
  });
});
