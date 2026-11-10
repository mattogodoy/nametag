import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import CalendarMonth from '@/components/calendar/CalendarMonth';
import type { CalendarEvent } from '@/lib/calendar-events';
import enMessages from '@/locales/en.json';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => replace.mockClear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const events: CalendarEvent[] = [
  {
    id: 'important-1-12',
    personId: 'person-1',
    personName: 'Ana Ruiz',
    type: 'important_date',
    title: 'Birthday',
    titleKey: null,
    day: 12,
  },
  {
    id: 'contact-2',
    personId: 'person-2',
    personName: 'Max Muster',
    type: 'contact_reminder',
    title: null,
    titleKey: 'timeToCatchUp',
    day: 12,
  },
];

function renderMonth(
  props: { year?: number; monthIndex?: number; events?: CalendarEvent[]; isDefaultMonth?: boolean } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CalendarMonth year={2026} monthIndex={4} events={events} {...props} />
    </NextIntlClientProvider>
  );
}

describe('CalendarMonth', () => {
  it('shows the month and year as the heading', () => {
    renderMonth();
    expect(screen.getByRole('heading', { level: 1, name: 'May 2026' })).toBeInTheDocument();
  });

  it('links to the neighbouring months and back to the current one', () => {
    renderMonth();
    expect(screen.getByRole('link', { name: enMessages.calendar.previousMonth })).toHaveAttribute(
      'href',
      '/calendar?month=2026-04'
    );
    expect(screen.getByRole('link', { name: enMessages.calendar.nextMonth })).toHaveAttribute(
      'href',
      '/calendar?month=2026-06'
    );
    expect(screen.getByRole('link', { name: enMessages.calendar.today })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/calendar\?month=\d{4}-\d{2}$/)
    );
  });

  it('points the Today link at the month of the browser clock', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 30, 23, 30) });
    renderMonth();
    expect(screen.getByRole('link', { name: enMessages.calendar.today })).toHaveAttribute(
      'href',
      '/calendar?month=2026-11'
    );
  });

  it('switches to the browser month when the server guessed another one', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 5, 1, 0, 30) });
    renderMonth({ year: 2026, monthIndex: 4, isDefaultMonth: true });
    expect(replace).toHaveBeenCalledWith('/calendar?month=2026-06');
  });

  it('keeps an explicitly chosen month and an agreeing default month', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 5, 1) });
    renderMonth({ year: 2026, monthIndex: 4 });
    renderMonth({ year: 2026, monthIndex: 5, isDefaultMonth: true });
    expect(replace).not.toHaveBeenCalled();
  });

  it('wraps from January back to December of the previous year', () => {
    renderMonth({ year: 2026, monthIndex: 0, events: [] });
    expect(screen.getByRole('link', { name: enMessages.calendar.previousMonth })).toHaveAttribute(
      'href',
      '/calendar?month=2025-12'
    );
  });

  it('renders seven weekday columns and every day of the month in the grid', () => {
    renderMonth({ events: [] });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(7);
    const cells = within(table).getAllByRole('cell');
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((cell) => /^31/.test(cell.textContent ?? ''))).toHaveLength(1);
  });

  it('links each event to the person and shows its title', () => {
    renderMonth();
    const table = screen.getByRole('table');
    const birthday = within(table).getByRole('link', { name: /Ana Ruiz/ });
    expect(birthday).toHaveAttribute('href', '/people/person-1');
    expect(birthday).toHaveTextContent('Birthday');
  });

  it('translates the title of a contact reminder', () => {
    renderMonth();
    const reminder = within(screen.getByRole('table')).getByRole('link', { name: /Max Muster/ });
    expect(reminder).toHaveAttribute('href', '/people/person-2');
    expect(reminder).toHaveTextContent(enMessages.dashboard.timeToCatchUp);
  });

  it('repeats the events in a day-by-day list for narrow screens', () => {
    renderMonth();
    expect(screen.getByRole('heading', { level: 2, name: /May 12/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Ana Ruiz/ })).toHaveLength(2);
  });

  it('says so when nothing is planned', () => {
    renderMonth({ events: [] });
    expect(screen.getByText(enMessages.calendar.noEvents)).toBeInTheDocument();
  });

  it('does not show the empty message when there are events', () => {
    renderMonth();
    expect(screen.queryByText(enMessages.calendar.noEvents)).not.toBeInTheDocument();
  });
});
