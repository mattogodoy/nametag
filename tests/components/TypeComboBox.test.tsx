import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TypeComboBox from '@/components/TypeComboBox';

describe('TypeComboBox', () => {
  const defaultOptions = [
    { value: 'Mobile', label: 'Mobile' },
    { value: 'Home', label: 'Home' },
    { value: 'Work', label: 'Work' },
  ];

  it('should render with initial value', () => {
    render(
      <TypeComboBox
        value="Mobile"
        onChange={vi.fn()}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    expect(input).toHaveValue('Mobile');
  });

  it('should allow typing custom values', async () => {
    const user = userEvent.setup();
    let currentValue = '';
    const onChange = vi.fn((newValue: string) => {
      currentValue = newValue;
    });

    const { rerender } = render(
      <TypeComboBox
        value={currentValue}
        onChange={onChange}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');

    // Type some text
    await user.type(input, 'Custom');

    // onChange is called for each character
    expect(onChange).toHaveBeenCalled();
    // It should have been called multiple times (once per character)
    expect(onChange.mock.calls.length).toBeGreaterThan(1);

    // The component accepts any string value
    expect(onChange.mock.calls.some(call => call[0].includes('C'))).toBe(true);
  });

  it('should show dropdown when focused', async () => {
    const user = userEvent.setup();

    render(
      <TypeComboBox
        value=""
        onChange={vi.fn()}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    await user.click(input);

    // Dropdown options should be visible
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('should select option from dropdown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TypeComboBox
        value=""
        onChange={onChange}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    await user.click(input);

    // Click on "Work" option
    const workOption = screen.getByRole('option', { name: 'Work' });
    await user.click(workOption);

    expect(onChange).toHaveBeenCalledWith('Work');
  });

  it('should close dropdown when option is selected', async () => {
    const user = userEvent.setup();

    render(
      <TypeComboBox
        value=""
        onChange={vi.fn()}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    await user.click(input);

    // Options should be visible
    expect(screen.getByRole('option', { name: 'Mobile' })).toBeInTheDocument();

    // Click an option
    await user.click(screen.getByRole('option', { name: 'Mobile' }));

    // Dropdown should close (options not visible)
    expect(screen.queryByRole('option', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('should toggle dropdown with dropdown button', async () => {
    const user = userEvent.setup();

    render(
      <TypeComboBox
        value=""
        onChange={vi.fn()}
        options={defaultOptions}
        placeholder="Type"
      />
    );

    // Find the dropdown toggle button by its aria-label
    const dropdownButton = screen.getByRole('button', { name: 'Toggle options' });
    await user.click(dropdownButton);

    // Dropdown should open
    expect(screen.getByRole('option', { name: 'Mobile' })).toBeInTheDocument();

    // Click again to close
    await user.click(dropdownButton);

    // Dropdown should close
    expect(screen.queryByRole('option', { name: 'Mobile' })).not.toBeInTheDocument();
  });

  it('should accept capitalized values', () => {
    const capitalizedOptions = [
      { value: 'Mobile', label: 'Mobile' },
      { value: 'Work', label: 'Work' },
    ];

    render(
      <TypeComboBox
        value="Mobile"
        onChange={vi.fn()}
        options={capitalizedOptions}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    expect(input).toHaveValue('Mobile'); // Capitalized
  });

  it('should handle empty options array', () => {
    render(
      <TypeComboBox
        value=""
        onChange={vi.fn()}
        options={[]}
        placeholder="Type"
      />
    );

    const input = screen.getByPlaceholderText('Type');
    expect(input).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TypeComboBox
        value=""
        onChange={vi.fn()}
        options={defaultOptions}
        placeholder="Type"
        className="custom-class"
      />
    );

    const input = container.querySelector('.custom-class');
    expect(input).toBeInTheDocument();
  });

  // ARIA attribute tests
  describe('ARIA attributes', () => {
    it('should have combobox role on input', () => {
      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
    });

    it('should have aria-expanded=false when closed', () => {
      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-expanded=true when open', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-autocomplete=list', () => {
      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('should have aria-controls pointing to listbox', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const listbox = screen.getByRole('listbox');
      expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    });

    it('should have listbox role on dropdown', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should have option role on each option', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('should have aria-selected on matching option', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value="Home"
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      const homeOption = screen.getByRole('option', { name: 'Home' });
      expect(homeOption).toHaveAttribute('aria-selected', 'true');

      const mobileOption = screen.getByRole('option', { name: 'Mobile' });
      expect(mobileOption).toHaveAttribute('aria-selected', 'false');
    });

    it('should have aria-label on toggle button', () => {
      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const toggleButton = screen.getByRole('button', { name: 'Toggle options' });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  // Keyboard navigation tests
  describe('keyboard navigation', () => {
    it('should open dropdown and highlight first option on ArrowDown', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Close the dropdown first by pressing Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      // Press ArrowDown to open
      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // First option should be highlighted (aria-activedescendant set)
      const firstOption = screen.getAllByRole('option')[0];
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOption.id);
    });

    it('should move highlight down with ArrowDown', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Press ArrowDown to highlight first option
      await user.keyboard('{ArrowDown}');
      const options = screen.getAllByRole('option');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);

      // Press ArrowDown again to highlight second option
      await user.keyboard('{ArrowDown}');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);
    });

    it('should move highlight up with ArrowUp', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Navigate down to second option
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[1].id);

      // Press ArrowUp to go back to first
      await user.keyboard('{ArrowUp}');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('should not go past the last option with ArrowDown', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Navigate to the last option
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);

      // Try going past the end
      await user.keyboard('{ArrowDown}');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[2].id);
    });

    it('should not go past the first option with ArrowUp', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Navigate to first option
      await user.keyboard('{ArrowDown}');

      const options = screen.getAllByRole('option');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);

      // Try going past the beginning
      await user.keyboard('{ArrowUp}');
      expect(input.getAttribute('aria-activedescendant')).toBe(options[0].id);
    });

    it('should select highlighted option on Enter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TypeComboBox
          value=""
          onChange={onChange}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Navigate to second option (Home)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Press Enter to select
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith('Home');
      // Dropdown should close
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Dropdown should be open
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Press Escape
      await user.keyboard('{Escape}');

      // Dropdown should close
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(input).toHaveAttribute('aria-expanded', 'false');
    });

    it('should clear aria-activedescendant when dropdown closes', async () => {
      const user = userEvent.setup();

      render(
        <TypeComboBox
          value=""
          onChange={vi.fn()}
          options={defaultOptions}
          placeholder="Type"
        />
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      // Highlight an option
      await user.keyboard('{ArrowDown}');
      expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

      // Close dropdown
      await user.keyboard('{Escape}');

      // aria-activedescendant should be cleared
      expect(input.getAttribute('aria-activedescendant')).toBeFalsy();
    });
  });
});
