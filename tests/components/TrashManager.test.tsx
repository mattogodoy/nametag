import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import TrashManager from '../../components/TrashManager';
import enMessages from '../../locales/en.json';

const deletedAt = new Date().toISOString();

const deletedByType: Record<string, unknown[]> = {
  people: [
    { id: 'p1', name: 'Jan', surname: 'Kowalski', nickname: null, displayNameOverride: null, deletedAt },
  ],
  groups: [],
  relationships: [
    {
      id: 'r1',
      deletedAt,
      person: { id: 'p2', name: 'Anna', surname: 'Nowak' },
      relatedPerson: { id: 'p3', name: 'Piotr', surname: null },
      relationshipType: { id: 't1', label: 'Friend' },
    },
  ],
  relationshipTypes: [],
  importantDates: [
    {
      id: 'd1',
      title: 'Birthday',
      date: '2000-05-17T00:00:00.000Z',
      deletedAt,
      person: { id: 'p4', name: 'Ewa', surname: 'Zielona' },
    },
  ],
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('TrashManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const type = new URL(String(input), 'http://localhost').searchParams.get('type') ?? '';
      return {
        ok: true,
        json: async () => ({ deleted: deletedByType[type] ?? [] }),
      } as Response;
    }) as typeof fetch;
  });

  // Regression: switching from the People tab used to render the people items
  // with the relationship/important-date label renderer for one frame, which
  // read fields people do not have and crashed the whole settings page.
  it('switches from People to Relationships and Important Dates without crashing', async () => {
    const user = userEvent.setup();
    render(<Wrapper><TrashManager /></Wrapper>);

    expect(await screen.findByText('Jan Kowalski')).toBeInTheDocument();

    // The tab buttons carry a count badge once the counts load, so their
    // accessible name is e.g. "Relationships1" (or just "Relationships" before).
    await user.click(screen.getByRole('button', { name: /^Relationships\d*$/ }));
    expect(await screen.findByText('Anna Nowak - Friend - Piotr')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Important Dates\d*$/ }));
    expect(await screen.findByText(/^Birthday \(.+\) for Ewa Zielona$/)).toBeInTheDocument();
  });
});
