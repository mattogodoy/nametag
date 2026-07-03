import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import ImportantDatesManager from '@/components/ImportantDatesManager';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('ImportantDatesManager - reminder toggle', () => {
  it('enables the reminder with one click when the date has a custom (free-text) title', async () => {
    // Regression: with a free-text title (type=null), the title combobox
    // committed its unchanged text on every outside mousedown, re-rendering
    // the manager and remounting the toggle mid-click, so the click was lost.
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Wrapper>
        <ImportantDatesManager
          mode="edit"
          initialDates={[
            {
              id: 'd1',
              type: null,
              title: 'Birthday',
              date: '2018-07-05',
              yearUnknown: false,
              reminderEnabled: false,
              reminderType: null,
              reminderInterval: 1,
              reminderIntervalUnit: 'YEARS',
            },
          ]}
          onChange={onChange}
        />
      </Wrapper>
    );

    await user.click(screen.getByTitle('Edit'));

    const toggle = document.getElementById('edit-0-reminder-toggle');
    expect(toggle).not.toBeNull();
    await user.click(toggle!);

    // Toggling on a past date selects RECURRING and shows the interval input
    expect(document.querySelector('input[type="number"][max="99"]')).toBeInTheDocument();
  });

  it('keeps focus in the reminder interval input while typing', async () => {
    // Regression: ReminderFields was defined inside the component, so every
    // parent re-render remounted it and dropped input focus per keystroke.
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ImportantDatesManager
          mode="edit"
          initialDates={[
            {
              id: 'd1',
              type: 'birthday',
              title: '',
              date: '2018-07-05',
              yearUnknown: false,
              reminderEnabled: true,
              reminderType: 'RECURRING',
              reminderInterval: 1,
              reminderIntervalUnit: 'YEARS',
            },
          ]}
        />
      </Wrapper>
    );

    await user.click(screen.getByTitle('Edit'));

    const interval = document.querySelector('input[type="number"][max="99"]') as HTMLInputElement;
    expect(interval).not.toBeNull();
    await user.click(interval);
    expect(interval).toHaveFocus();

    await user.keyboard('5');
    expect(document.querySelector('input[type="number"][max="99"]')).toHaveFocus();
  });
});
