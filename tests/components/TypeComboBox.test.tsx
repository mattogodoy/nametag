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
    const workButton = screen.getByRole('button', { name: 'Work' });
    await user.click(workButton);

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
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeInTheDocument();

    // Click an option
    await user.click(screen.getByRole('button', { name: 'Mobile' }));

    // Dropdown should close (options not visible as buttons)
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
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

    // Find the dropdown toggle button (svg icon)
    const dropdownButton = screen.getByRole('button', { hidden: true });
    await user.click(dropdownButton);

    // Dropdown should open
    expect(screen.getByRole('button', { name: 'Mobile' })).toBeInTheDocument();

    // Click again to close
    await user.click(dropdownButton);

    // Dropdown should close
    expect(screen.queryByRole('button', { name: 'Mobile' })).not.toBeInTheDocument();
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
});
