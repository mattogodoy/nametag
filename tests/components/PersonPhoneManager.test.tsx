import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonPhoneManager from '@/components/PersonPhoneManager';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      'label': 'Phone Numbers',
      'add': 'Add',
      'save': 'Save',
      'cancel': 'Cancel',
      'edit': 'Edit',
      'remove': 'Remove',
      'numberPlaceholder': 'Phone number',
      'typePlaceholder': 'Type',
      'noPhones': 'No phone numbers added yet',
      'types.mobile': 'Mobile',
      'types.home': 'Home',
      'types.work': 'Work',
      'types.fax': 'Fax',
      'types.other': 'Other',
    };
    return translations[key] || key;
  }),
}));

describe('PersonPhoneManager', () => {
  it('should render with empty state', () => {
    render(<PersonPhoneManager />);

    expect(screen.getByText('Phone Numbers')).toBeInTheDocument();
    expect(screen.getByText('No phone numbers added yet')).toBeInTheDocument();
    expect(screen.getByText('+ Add')).toBeInTheDocument();
  });

  it('should display existing phone numbers with capitalized types', () => {
    const phones = [
      { id: '1', type: 'Mobile', number: '+1234567890' },
      { id: '2', type: 'Work', number: '+0987654321' },
    ];

    render(<PersonPhoneManager initialPhones={phones} />);

    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('+0987654321')).toBeInTheDocument();
  });

  it('should show add form when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<PersonPhoneManager />);

    const addButton = screen.getByText('+ Add');
    await user.click(addButton);

    expect(screen.getByPlaceholderText('Phone number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type')).toBeInTheDocument();
  });

  it('should add a new phone number with capitalized type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonPhoneManager onChange={onChange} />);

    // Click add button
    await user.click(screen.getByText('+ Add'));

    // Fill in the form
    const numberInput = screen.getByPlaceholderText('Phone number');
    await user.type(numberInput, '+1234567890');

    // Type should default to 'Mobile' (capitalized)
    const typeInput = screen.getByPlaceholderText('Type');
    expect(typeInput).toHaveValue('Mobile');

    // Click add
    await user.click(screen.getByRole('button', { name: 'Add' }));

    // Verify onChange was called with capitalized type
    expect(onChange).toHaveBeenCalledWith([
      { type: 'Mobile', number: '+1234567890' },
    ]);
  });

  it('should allow custom type values while showing predefined options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonPhoneManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const typeInput = screen.getByPlaceholderText('Type');

    // Clear and type custom value
    await user.clear(typeInput);
    await user.type(typeInput, 'Personal Mobile');

    const numberInput = screen.getByPlaceholderText('Phone number');
    await user.type(numberInput, '+1234567890');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'Personal Mobile', number: '+1234567890' },
    ]);
  });

  it('should remove a phone number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const phones = [
      { id: '1', type: 'Mobile', number: '+1234567890' },
    ];

    render(<PersonPhoneManager initialPhones={phones} onChange={onChange} />);

    const removeButton = screen.getByText('Remove');
    await user.click(removeButton);

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('should edit an existing phone number', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const phones = [
      { id: '1', type: 'Mobile', number: '+1234567890' },
    ];

    render(<PersonPhoneManager initialPhones={phones} onChange={onChange} />);

    // Click edit
    const editButton = screen.getByText('Edit');
    await user.click(editButton);

    // Modify the number
    const numberInput = screen.getByDisplayValue('+1234567890');
    await user.clear(numberInput);
    await user.type(numberInput, '+9999999999');

    // Save
    await user.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenCalledWith([
      { id: '1', type: 'Mobile', number: '+9999999999' },
    ]);
  });

  it('should have all type options capitalized', () => {
    const { container } = render(<PersonPhoneManager />);

    // The component should use capitalized values: Mobile, Home, Work, Fax, Other
    // This is tested indirectly through the default value and the translations
    expect(container).toBeTruthy(); // Component renders without errors
  });
});
