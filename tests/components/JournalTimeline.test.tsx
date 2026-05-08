import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import JournalTimeline from '../../components/JournalTimeline';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

const baseEntry = {
  id: 'entry-1',
  title: 'Coffee with Sara',
  body: 'Caught up over espresso.',
  people: [],
};

describe('JournalTimeline', () => {
  it('omits the time line when hasTime is false', () => {
    const entries = [{
      ...baseEntry,
      date: '2026-05-07T00:00:00.000Z',
      hasTime: false,
    }];
    render(
      <Wrapper>
        <JournalTimeline entries={entries} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.queryByText(/AM|PM|\d:\d{2}/)).toBeNull();
  });

  it('renders the locale-formatted time when hasTime is true', () => {
    const entries = [{
      ...baseEntry,
      // 14:30 UTC. The test runner's timezone affects the displayed local
      // time, but both 12h ("PM") and 24h (":30") forms include "30".
      date: '2026-05-07T14:30:00.000Z',
      hasTime: true,
    }];
    render(
      <Wrapper>
        <JournalTimeline entries={entries} nameOrder="WESTERN" locale="en" />
      </Wrapper>
    );
    expect(screen.getByText(/:30/)).toBeInTheDocument();
  });
});
