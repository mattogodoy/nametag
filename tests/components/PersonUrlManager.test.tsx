import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonUrlManager from '@/components/PersonUrlManager';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      'label': 'URLs',
      'add': 'Add',
      'save': 'Save',
      'cancel': 'Cancel',
      'edit': 'Edit',
      'remove': 'Remove',
      'urlPlaceholder': 'https://example.com',
      'typePlaceholder': 'Type',
      'noUrls': 'No websites added yet',
      'types.personal': 'Personal',
      'types.work': 'Work',
      'types.other': 'Other',
    };
    return translations[key] || key;
  }),
}));

describe('PersonUrlManager', () => {
  it('should render with empty state', () => {
    render(<PersonUrlManager />);

    expect(screen.getByText('URLs')).toBeInTheDocument();
    expect(screen.getByText('No websites added yet')).toBeInTheDocument();
  });

  it('should display existing URLs with capitalized types', () => {
    const urls = [
      { id: '1', type: 'Personal', url: 'https://personal.com' },
      { id: '2', type: 'Work', url: 'https://work.com' },
    ];

    render(<PersonUrlManager initialUrls={urls} />);

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('https://personal.com')).toBeInTheDocument();
  });

  it('should NOT have "Home" type option', async () => {
    const user = userEvent.setup();
    render(<PersonUrlManager />);

    await user.click(screen.getByText('+ Add'));

    // The type should default to "Personal", not "Home"
    const typeInput = screen.getByPlaceholderText('Type');
    expect(typeInput).toHaveValue('Personal');
  });

  it('should only offer Personal, Work, Other (no Home)', () => {
    const urls = [
      { id: '1', type: 'Personal', url: 'https://example.com' },
    ];

    render(<PersonUrlManager initialUrls={urls} />);

    // Should not show "Home" anywhere
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('should add a new URL with capitalized type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonUrlManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const urlInput = screen.getByPlaceholderText('https://example.com');
    await user.type(urlInput, 'https://mywebsite.com');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'Personal', url: 'https://mywebsite.com' },
    ]);
  });

  it('should render URLs as clickable links', () => {
    const urls = [
      { id: '1', type: 'Personal', url: 'https://example.com' },
    ];

    render(<PersonUrlManager initialUrls={urls} />);

    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should allow custom type values', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonUrlManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const typeInput = screen.getByPlaceholderText('Type');
    await user.clear(typeInput);
    await user.type(typeInput, 'Portfolio');

    const urlInput = screen.getByPlaceholderText('https://example.com');
    await user.type(urlInput, 'https://portfolio.com');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'Portfolio', url: 'https://portfolio.com' },
    ]);
  });
});
