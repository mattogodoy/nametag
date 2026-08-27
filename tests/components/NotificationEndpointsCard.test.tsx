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

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
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

  it('surfaces the success message for a successful test send', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
    renderCard({ endpoints: [endpoint] });

    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

    await waitFor(() => {
      expect(screen.getByText('Test notification sent.')).toBeInTheDocument();
    });
  });

  describe('failure code mapping', () => {
    it.each([
      ['blocked', 'That URL cannot be used. Change it and save again.'],
      ['dns', 'That hostname did not resolve. Check the spelling, or try again in a moment.'],
      [
        'http_4xx',
        'The destination rejected the notification. Check the topic name and the access token.',
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
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Not found' }, false)));
      renderCard({ endpoints: [endpoint] });

      fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));

      await waitFor(() => {
        expect(
          screen.getByText(
            'Could not reach that destination. It may be temporary, so it is worth trying again.'
          )
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

  it('does not display an access token field value anywhere after creating an endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ endpoint: { id: 'ep-2' } }, true));
    vi.stubGlobal('fetch', fetchMock);
    renderCard({ endpoints: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Add ntfy topic' }));

    const tokenInput = screen.getByLabelText('Access token (optional)') as HTMLInputElement;
    expect(tokenInput.type).toBe('password');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My phone' } });
    fireEvent.change(screen.getByLabelText('Topic URL'), {
      target: { value: 'https://ntfy.sh/my-topic' },
    });
    fireEvent.change(tokenInput, { target: { value: 'tk_secret_value' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
    // The token was submitted but never rendered as visible text.
    expect(screen.queryByText('tk_secret_value')).not.toBeInTheDocument();
  });
});
