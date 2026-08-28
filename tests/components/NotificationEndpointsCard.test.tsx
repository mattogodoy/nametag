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
      <NotificationEndpointsCard endpoints={[]} canAdd={true} {...props} />
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

const endpoint: NotificationEndpointSummary = {
  id: 'ep-1',
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

    expect(screen.getByText('No destinations yet.')).toBeTruthy();
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
      [
        'redirect',
        'That address redirects to a different location, which is not supported. Point the topic URL at its final destination.',
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
});
