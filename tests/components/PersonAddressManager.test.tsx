import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonAddressManager from '@/components/PersonAddressManager';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      'label': 'Addresses',
      'add': 'Add',
      'save': 'Save',
      'cancel': 'Cancel',
      'edit': 'Edit',
      'remove': 'Remove',
      'streetLine1Placeholder': 'Street address line 1',
      'streetLine2Placeholder': 'Street address line 2 (optional)',
      'cityPlaceholder': 'City',
      'regionPlaceholder': 'State/Province',
      'postalCodePlaceholder': 'Postal code',
      'countryPlaceholder': 'Country',
      'typePlaceholder': 'Type',
      'noAddresses': 'No addresses added yet',
      'noAddressData': '(No address data)',
      'types.home': 'Home',
      'types.work': 'Work',
      'types.other': 'Other',
    };
    return translations[key] || key;
  }),
}));

describe('PersonAddressManager', () => {
  it('should render with empty state', () => {
    render(<PersonAddressManager />);

    expect(screen.getByText('Addresses')).toBeInTheDocument();
    expect(screen.getByText('No addresses added yet')).toBeInTheDocument();
  });

  it('should display existing addresses with capitalized types', () => {
    const addresses = [
      {
        id: '1',
        type: 'Home',
        streetLine1: '123 Main St',
        streetLine2: 'Apt 4',
        locality: 'San Francisco',
        region: 'CA',
        postalCode: '94102',
        country: 'US',
      },
    ];

    render(<PersonAddressManager initialAddresses={addresses} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
  });

  it('should render country dropdown with ISO codes', async () => {
    const user = userEvent.setup();
    render(<PersonAddressManager />);

    await user.click(screen.getByText('+ Add'));

    // Find the country select element
    const countrySelect = screen.getByRole('combobox');
    expect(countrySelect).toBeInTheDocument();

    // Should have option with Spain
    const options = within(countrySelect).getAllByRole('option');
    const spainOption = options.find(opt => opt.textContent === 'Spain');
    expect(spainOption).toBeInTheDocument();
    expect(spainOption).toHaveValue('ES'); // ISO code
  });

  it('should store country as 2-letter ISO code', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonAddressManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    // Fill in address
    const streetInput = screen.getByPlaceholderText('Street address line 1');
    await user.type(streetInput, 'Calle Mayor 1');

    // Select country
    const countrySelect = screen.getByRole('combobox');
    await user.selectOptions(countrySelect, 'ES');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    // Verify country is stored as ISO code
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        country: 'ES',
        streetLine1: 'Calle Mayor 1',
      }),
    ]);
  });

  it('should display country name in formatted address', () => {
    const addresses = [
      {
        id: '1',
        type: 'Home',
        streetLine1: 'Calle Mayor 1',
        locality: 'Madrid',
        country: 'ES', // ISO code
      },
    ];

    render(<PersonAddressManager initialAddresses={addresses} />);

    // Should display "Spain" not "ES"
    expect(screen.getByText(/Spain/)).toBeInTheDocument();
  });

  it('should support both streetLine1 and streetLine2', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonAddressManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const street1Input = screen.getByPlaceholderText('Street address line 1');
    const street2Input = screen.getByPlaceholderText('Street address line 2 (optional)');

    await user.type(street1Input, '123 Main St');
    await user.type(street2Input, 'Suite 200');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        streetLine1: '123 Main St',
        streetLine2: 'Suite 200',
      }),
    ]);
  });

  it('should default to "Home" type (capitalized)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonAddressManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const typeInput = screen.getByPlaceholderText('Type');
    expect(typeInput).toHaveValue('Home');
  });

  it('should include common countries in dropdown', async () => {
    const user = userEvent.setup();
    render(<PersonAddressManager />);

    await user.click(screen.getByText('+ Add'));

    const countrySelect = screen.getByRole('combobox');
    const options = within(countrySelect).getAllByRole('option');
    const optionTexts = options.map(opt => opt.textContent);

    // Check for common countries
    expect(optionTexts).toContain('Spain');
    expect(optionTexts).toContain('United States');
    expect(optionTexts).toContain('United Kingdom');
    expect(optionTexts).toContain('France');
    expect(optionTexts).toContain('Germany');
  });

  it('should handle null country values gracefully', () => {
    const addresses = [
      {
        id: '1',
        type: 'Home',
        streetLine1: '123 Main St',
        locality: 'City',
        country: null,
      },
    ];

    render(<PersonAddressManager initialAddresses={addresses} />);

    // Should render without errors
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument();
  });
});
