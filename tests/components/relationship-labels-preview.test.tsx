import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
        subjectRef: 'gender',
        operator: 'IS',
        operand: 'lit:woman',
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

describe('LabelPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
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
});
