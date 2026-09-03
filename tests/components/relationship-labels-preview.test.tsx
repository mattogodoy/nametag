import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import LabelPreview from '../../components/relationship-labels/LabelPreview';
import type { LabelVariant } from '../../lib/relationship-labels/types';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const people = [
  { id: 'person-1', name: 'Ada Lovelace' },
  { id: 'person-2', name: 'Grace Hopper' },
  { id: 'person-3', name: 'Barbara Liskov' },
];

const variants: LabelVariant[] = [
  {
    label: 'soeur',
    conditions: [
      {
        subject: 'DESCRIBED',
        source: 'PERSON_FIELD',
        subjectRef: 'nickname',
        operator: 'IS',
        operand: 'lit:Coco',
      },
    ],
  },
];

function renderPreview() {
  render(
    <Wrapper>
      <LabelPreview typeLabel="sibling" variants={variants} people={people} />
    </Wrapper>
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('LabelPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders two contact selectors populated from the supplied people', () => {
    renderPreview();

    const described = screen.getByRole('combobox', { name: 'Described person' });
    const other = screen.getByRole('combobox', { name: 'Other person' });

    expect(described).toBeInTheDocument();
    expect(other).toBeInTheDocument();
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Grace Hopper').length).toBeGreaterThan(0);
  });

  it('posts to /api/relationship-types/preview-label with the current variants and the two person ids when a selector changes', async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'soeur', variantIndex: 0 }),
    });

    renderPreview();

    const other = screen.getByRole('combobox', { name: 'Other person' });
    await user.selectOptions(other, 'person-3');

    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/relationship-types/preview-label',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              typeLabel: 'sibling',
              describedPersonId: 'person-1',
              otherPersonId: 'person-3',
              variants,
            }),
          })
        );
      },
      { timeout: 1000 }
    );
  });

  it('renders the returned label in the result sentence', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'soeur', variantIndex: 0 }),
    });

    renderPreview();

    await waitFor(
      () => {
        expect(
          screen.getByText('Ada Lovelace is soeur of Grace Hopper.')
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('renders the matched-variant line when variantIndex is a number', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'soeur', variantIndex: 0 }),
    });

    renderPreview();

    await waitFor(
      () => {
        expect(screen.getByText('Variant 1 applied.')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('renders the fallback line when variantIndex is null', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'sibling', variantIndex: null }),
    });

    renderPreview();

    await waitFor(
      () => {
        expect(
          screen.getByText('No variant matched, the fallback applied.')
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('renders the failure string and no stale result when the request fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ label: 'soeur', variantIndex: 0 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'boom' }),
      });

    const user = userEvent.setup();
    renderPreview();

    await waitFor(
      () => {
        expect(
          screen.getByText('Ada Lovelace is soeur of Grace Hopper.')
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    const other = screen.getByRole('combobox', { name: 'Other person' });
    await user.selectOptions(other, 'person-3');

    await waitFor(
      () => {
        expect(
          screen.getByText('The preview could not be computed.')
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    expect(
      screen.queryByText('Ada Lovelace is soeur of Grace Hopper.')
    ).not.toBeInTheDocument();
  });

  it('applies only the latest response when an earlier request resolves after a later one', async () => {
    const user = userEvent.setup();
    const first = deferred<{ ok: boolean; json: () => Promise<{ label: string; variantIndex: number | null }> }>();
    const second = deferred<{ ok: boolean; json: () => Promise<{ label: string; variantIndex: number | null }> }>();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);

    renderPreview();

    // First request: fired by the initial described/other selection on mount.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), { timeout: 1000 });

    // Second request: fired by changing the selector to a third contact.
    const other = screen.getByRole('combobox', { name: 'Other person' });
    await user.selectOptions(other, 'person-3');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 1000 });

    // The later request (second) resolves first with its own result.
    second.resolve({ ok: true, json: async () => ({ label: 'frère', variantIndex: 1 }) });
    await waitFor(
      () => {
        expect(
          screen.getByText('Ada Lovelace is frère of Barbara Liskov.')
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );

    // The earlier request (first) resolves last: it must not overwrite the
    // newer result that is already displayed.
    first.resolve({ ok: true, json: async () => ({ label: 'soeur', variantIndex: 0 }) });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(
      screen.getByText('Ada Lovelace is frère of Barbara Liskov.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ada Lovelace is soeur of Grace Hopper.')
    ).not.toBeInTheDocument();
  });

  it('does not fetch when there are no variants to preview (Minor 5: <details> mount)', async () => {
    // A <details> element hides its children instead of unmounting them, so
    // this effect still runs when a user opens New/Edit relationship type
    // with nothing configured yet. There is nothing to preview, so no
    // request should go out.
    vi.useFakeTimers();
    render(
      <Wrapper>
        <LabelPreview typeLabel="sibling" variants={[]} people={people} />
      </Wrapper>
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('coalesces a rapid sequence of selector changes into a single request once the debounce settles', async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ label: 'soeur', variantIndex: 0 }),
    });

    render(
      <Wrapper>
        <LabelPreview typeLabel="sibling" variants={variants} people={people} />
      </Wrapper>
    );

    const other = screen.getByRole('combobox', { name: 'Other person' });
    fireEvent.change(other, { target: { value: 'person-3' } });
    fireEvent.change(other, { target: { value: 'person-1' } });
    fireEvent.change(other, { target: { value: 'person-3' } });

    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
