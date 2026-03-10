import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import DatePicker from '../../components/ui/DatePicker';
import enMessages from '../../locales/en.json';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('DatePicker', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render month, day, and year fields', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      expect(screen.getByLabelText('Month')).toBeInTheDocument();
      expect(screen.getByLabelText('Day')).toBeInTheDocument();
      expect(screen.getByLabelText('Year')).toBeInTheDocument();
    });

    it('should render fields in MDY order', () => {
      const { container } = render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const fields = container.querySelectorAll('[data-datepicker-field]');
      expect(fields).toHaveLength(3);
      expect(fields[0].getAttribute('data-datepicker-field')).toBe('month');
      expect(fields[1].getAttribute('data-datepicker-field')).toBe('day');
      expect(fields[2].getAttribute('data-datepicker-field')).toBe('year');
    });

    it('should render fields in DMY order', () => {
      const { container } = render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="DMY"
          />
        </Wrapper>
      );

      const fields = container.querySelectorAll('[data-datepicker-field]');
      expect(fields).toHaveLength(3);
      expect(fields[0].getAttribute('data-datepicker-field')).toBe('day');
      expect(fields[1].getAttribute('data-datepicker-field')).toBe('month');
      expect(fields[2].getAttribute('data-datepicker-field')).toBe('year');
    });

    it('should render fields in YMD order', () => {
      const { container } = render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="YMD"
          />
        </Wrapper>
      );

      const fields = container.querySelectorAll('[data-datepicker-field]');
      expect(fields).toHaveLength(3);
      expect(fields[0].getAttribute('data-datepicker-field')).toBe('year');
      expect(fields[1].getAttribute('data-datepicker-field')).toBe('month');
      expect(fields[2].getAttribute('data-datepicker-field')).toBe('day');
    });
  });

  describe('Value population', () => {
    it('should populate fields from ISO value', () => {
      render(
        <Wrapper>
          <DatePicker
            value="1990-03-15"
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month') as HTMLSelectElement;
      const daySelect = screen.getByLabelText('Day') as HTMLSelectElement;
      const yearInput = screen.getByLabelText('Year') as HTMLInputElement;

      expect(monthSelect.value).toBe('3');
      expect(daySelect.value).toBe('15');
      expect(yearInput.value).toBe('1990');
    });

    it('should handle empty value', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month') as HTMLSelectElement;
      const daySelect = screen.getByLabelText('Day') as HTMLSelectElement;
      const yearInput = screen.getByLabelText('Year') as HTMLInputElement;

      expect(monthSelect.value).toBe('');
      expect(daySelect.value).toBe('');
      expect(yearInput.value).toBe('');
    });
  });

  describe('onChange behavior', () => {
    it('should call onChange with ISO string when all fields are filled', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month');
      const daySelect = screen.getByLabelText('Day');
      const yearInput = screen.getByLabelText('Year');

      await user.selectOptions(monthSelect, '3');
      await user.selectOptions(daySelect, '15');
      await user.clear(yearInput);
      await user.type(yearInput, '1990');

      expect(mockOnChange).toHaveBeenCalledWith('1990-03-15');
    });

    it('should not call onChange when fields are incomplete', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month');
      await user.selectOptions(monthSelect, '3');

      // onChange should not be called with a complete ISO string yet
      // It may be called with '' to indicate incomplete, but not with a date
      const dateCallArgs = mockOnChange.mock.calls
        .map((call: string[]) => call[0])
        .filter((val: string) => val !== '');
      expect(dateCallArgs).toHaveLength(0);
    });
  });

  describe('Day clamping', () => {
    it('should clamp day when switching to shorter month', async () => {
      const user = userEvent.setup();

      render(
        <Wrapper>
          <DatePicker
            value="2024-01-31"
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month');
      // Switch from January (31 days) to February (29 days in 2024)
      await user.selectOptions(monthSelect, '2');

      // Should call onChange with clamped day
      expect(mockOnChange).toHaveBeenCalledWith('2024-02-29');
    });

    it('should adjust day options based on selected month', async () => {
      userEvent.setup();

      render(
        <Wrapper>
          <DatePicker
            value="2024-02-15"
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const daySelect = screen.getByLabelText('Day');
      // February 2024 is a leap year, should have 29 options
      const options = within(daySelect as HTMLElement).getAllByRole('option');
      // +1 for the placeholder option
      expect(options).toHaveLength(30); // 29 days + 1 placeholder
    });

    it('should clamp day when year changes from leap to non-leap', async () => {
      const user = userEvent.setup();
      render(
        <Wrapper>
          <DatePicker
            value="2024-02-29"
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      // Day should be 29 initially (2024 is leap year)
      expect(screen.getByLabelText('Day')).toHaveValue('29');

      // Change year to 2023 (non-leap)
      const yearInput = screen.getByLabelText('Year');
      await user.clear(yearInput);
      await user.type(yearInput, '2023');

      // Day should clamp to 28
      expect(screen.getByLabelText('Day')).toHaveValue('28');
    });

    it('should show 28 days for February in non-leap year', async () => {
      render(
        <Wrapper>
          <DatePicker
            value="2023-02-15"
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const daySelect = screen.getByLabelText('Day');
      const options = within(daySelect as HTMLElement).getAllByRole('option');
      expect(options).toHaveLength(29); // 28 days + 1 placeholder
    });
  });

  describe('Year unknown', () => {
    it('should hide year field when yearUnknown is true', () => {
      render(
        <Wrapper>
          <DatePicker
            value="2024-03-15"
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={true}
            yearUnknown={true}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      expect(screen.queryByLabelText('Year')).not.toBeInTheDocument();
    });

    it('should show year field when yearUnknown is false', () => {
      render(
        <Wrapper>
          <DatePicker
            value="2024-03-15"
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={true}
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      expect(screen.getByLabelText('Year')).toBeInTheDocument();
    });

    it('should show checkbox when showYearToggle is true', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={true}
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      expect(screen.getByLabelText('Year unknown')).toBeInTheDocument();
    });

    it('should not show checkbox when showYearToggle is false', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={false}
          />
        </Wrapper>
      );

      expect(screen.queryByLabelText('Year unknown')).not.toBeInTheDocument();
    });

    it('should call onYearUnknownChange when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const mockYearUnknownChange = vi.fn();

      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={true}
            yearUnknown={false}
            onYearUnknownChange={mockYearUnknownChange}
          />
        </Wrapper>
      );

      const checkbox = screen.getByLabelText('Year unknown');
      await user.click(checkbox);

      expect(mockYearUnknownChange).toHaveBeenCalledWith(true);
    });

    it('should emit date with current year as placeholder in year-unknown mode', async () => {
      const user = userEvent.setup();
      const currentYear = new Date().getFullYear();

      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle={true}
            yearUnknown={true}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month');
      const daySelect = screen.getByLabelText('Day');

      await user.selectOptions(monthSelect, '6');
      await user.selectOptions(daySelect, '20');

      expect(mockOnChange).toHaveBeenCalledWith(
        `${currentYear}-06-20`
      );
    });

    it('should re-emit when yearUnknown changes to true with month+day already set', () => {
      const currentYear = new Date().getFullYear();

      // Render with a date value and yearUnknown=false
      const { rerender } = render(
        <Wrapper>
          <DatePicker
            value={`${currentYear}-03-15`}
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      mockOnChange.mockClear();

      // Simulate parent setting yearUnknown=true (user checked the checkbox)
      rerender(
        <Wrapper>
          <DatePicker
            value={`${currentYear}-03-15`}
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={true}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      // Should re-emit the date with current year placeholder
      expect(mockOnChange).toHaveBeenCalledWith(`${currentYear}-03-15`);
    });

    it('should clear year and emit empty when yearUnknown changes from true to false', () => {
      // Render with yearUnknown=true and a date
      const { rerender } = render(
        <Wrapper>
          <DatePicker
            value={`1604-06-15`}
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={true}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      mockOnChange.mockClear();

      // Simulate parent setting yearUnknown=false (user unchecked the checkbox)
      rerender(
        <Wrapper>
          <DatePicker
            value={`1604-06-15`}
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      // Should emit empty string (year is now required but missing)
      expect(mockOnChange).toHaveBeenCalledWith('');
    });

    it('should preserve month and day when yearUnknown transitions from true to false', () => {
      // Render with yearUnknown=true and a date with 1604 year
      const { rerender } = render(
        <Wrapper>
          <DatePicker
            value="1604-06-15"
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={true}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      mockOnChange.mockClear();

      // Step 1: Parent sets yearUnknown=false (value unchanged yet)
      rerender(
        <Wrapper>
          <DatePicker
            value="1604-06-15"
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      expect(mockOnChange).toHaveBeenCalledWith('');
      mockOnChange.mockClear();

      // Step 2: Parent receives '' from onChange and updates value
      rerender(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showYearToggle
            yearUnknown={false}
            onYearUnknownChange={vi.fn()}
          />
        </Wrapper>
      );

      // Month and day should still be populated despite value being ''
      const monthSelect = screen.getByLabelText('Month') as HTMLSelectElement;
      const daySelect = screen.getByLabelText('Day') as HTMLSelectElement;
      const yearInput = screen.getByLabelText('Year') as HTMLInputElement;

      expect(monthSelect.value).toBe('6');
      expect(daySelect.value).toBe('15');
      expect(yearInput.value).toBe('');
    });
  });

  describe('Today button', () => {
    it('should show Today button when showTodayButton is true', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showTodayButton={true}
          />
        </Wrapper>
      );

      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('should not show Today button when showTodayButton is false', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showTodayButton={false}
          />
        </Wrapper>
      );

      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });

    it('should fill fields with today date when Today button is clicked', async () => {
      const user = userEvent.setup();
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const expectedISO = `${year}-${month}-${day}`;

      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            showTodayButton={true}
          />
        </Wrapper>
      );

      await user.click(screen.getByText('Today'));

      expect(mockOnChange).toHaveBeenCalledWith(expectedISO);
    });
  });

  describe('Disabled state', () => {
    it('should disable all fields when disabled is true', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            disabled={true}
            showTodayButton={true}
          />
        </Wrapper>
      );

      expect(screen.getByLabelText('Month')).toBeDisabled();
      expect(screen.getByLabelText('Day')).toBeDisabled();
      expect(screen.getByLabelText('Year')).toBeDisabled();
      expect(screen.getByText('Today')).toBeDisabled();
    });
  });

  describe('Month select options', () => {
    it('should display 12 month options plus placeholder', () => {
      render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
          />
        </Wrapper>
      );

      const monthSelect = screen.getByLabelText('Month');
      const options = within(monthSelect as HTMLElement).getAllByRole('option');
      // 12 months + 1 placeholder
      expect(options).toHaveLength(13);
    });
  });

  describe('ID prop', () => {
    it('should pass id to the container', () => {
      const { container } = render(
        <Wrapper>
          <DatePicker
            value=""
            onChange={mockOnChange}
            dateFormat="MDY"
            id="birth-date"
          />
        </Wrapper>
      );

      expect(container.querySelector('#birth-date')).toBeInTheDocument();
    });
  });
});
