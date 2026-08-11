import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
          defaultReminderLeadDays={0}
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
          defaultReminderLeadDays={0}
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

describe('ImportantDatesManager - per-date advance notice override', () => {
  it('shows the resolved account default and lets an explicit "on the day only" override it', async () => {
    // Regression for the three-state model: null (inherit default), 0 (day-of
    // only, an explicit override), and a positive integer must stay distinct
    // choices in the UI, not collapse into one control.
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    render(
      <Wrapper>
        <ImportantDatesManager
          mode="edit"
          personId="person-1"
          defaultReminderLeadDays={7}
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
              reminderLeadDays: null,
            },
          ]}
        />
      </Wrapper>
    );

    await user.click(screen.getByTitle('Edit'));

    const leadTimeSelect = screen.getByRole('combobox', { name: 'Notify me' }) as HTMLSelectElement;
    expect(leadTimeSelect).toHaveValue('default');
    expect(screen.getByText('Default (7 days before)')).toBeInTheDocument();

    await user.selectOptions(leadTimeSelect, '0');
    expect(leadTimeSelect).toHaveValue('0');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    // 0 must reach the server as 0, not null: collapsing it into "no
    // override" would silently fall back to the account default.
    expect(body.reminderLeadDays).toBe(0);
  });

  it('shows the true value instead of rendering blank when the override is not one of the presets', async () => {
    // Regression: the API accepts 0-365, but the select only offered the six
    // presets, so a value like 10 (set via the API) rendered blank while the
    // summary text right below it correctly read "10 days before".
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ImportantDatesManager
          mode="edit"
          personId="person-1"
          defaultReminderLeadDays={7}
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
              reminderLeadDays: 10,
            },
          ]}
        />
      </Wrapper>
    );

    await user.click(screen.getByTitle('Edit'));

    const leadTimeSelect = screen.getByRole('combobox', { name: 'Notify me' }) as HTMLSelectElement;
    expect(leadTimeSelect).toHaveValue('10');
    expect(screen.getByText('10 days before')).toBeInTheDocument();
  });

  it('sends null when a date is left on "Default"', async () => {
    // The other half of the same three-state guarantee as the test above:
    // leaving the control untouched must persist as an explicit "inherit",
    // not silently pick up whatever the account default happened to be at
    // save time.
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    render(
      <Wrapper>
        <ImportantDatesManager
          mode="edit"
          personId="person-1"
          defaultReminderLeadDays={7}
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
              reminderLeadDays: null,
            },
          ]}
        />
      </Wrapper>
    );

    await user.click(screen.getByTitle('Edit'));

    const leadTimeSelect = screen.getByRole('combobox', { name: 'Notify me' }) as HTMLSelectElement;
    expect(leadTimeSelect).toHaveValue('default');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.reminderLeadDays).toBeNull();
  });
});
