import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonEmailManager from '@/components/PersonEmailManager';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const translations: Record<string, string> = {
      'label': 'Email Addresses',
      'add': 'Add',
      'save': 'Save',
      'cancel': 'Cancel',
      'edit': 'Edit',
      'remove': 'Remove',
      'emailPlaceholder': 'email@example.com',
      'typePlaceholder': 'Type',
      'noEmails': 'No email addresses added yet',
      'types.personal': 'Personal',
      'types.work': 'Work',
      'types.other': 'Other',
    };
    return translations[key] || key;
  }),
}));

describe('PersonEmailManager', () => {
  it('should render with empty state', () => {
    render(<PersonEmailManager />);

    expect(screen.getByText('Email Addresses')).toBeInTheDocument();
    expect(screen.getByText('No email addresses added yet')).toBeInTheDocument();
  });

  it('should display existing emails with capitalized types', () => {
    const emails = [
      { id: '1', type: 'Personal', email: 'personal@example.com' },
      { id: '2', type: 'Work', email: 'work@example.com' },
    ];

    render(<PersonEmailManager initialEmails={emails} />);

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('personal@example.com')).toBeInTheDocument();
    expect(screen.getByText('work@example.com')).toBeInTheDocument();
  });

  it('should default to "Personal" type (not "home")', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonEmailManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const typeInput = screen.getByPlaceholderText('Type');
    expect(typeInput).toHaveValue('Personal');
  });

  it('should add a new email with Personal type', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PersonEmailManager onChange={onChange} />);

    await user.click(screen.getByText('+ Add'));

    const emailInput = screen.getByPlaceholderText('email@example.com');
    await user.type(emailInput, 'test@example.com');

    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenCalledWith([
      { type: 'Personal', email: 'test@example.com' },
    ]);
  });

  it('should not have "home" type option', () => {
    const emails = [
      { id: '1', type: 'Personal', email: 'test@example.com' },
    ];

    render(<PersonEmailManager initialEmails={emails} />);

    // Should show "Personal" not "home"
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.queryByText('home')).not.toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  it('should allow editing email type to custom value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const emails = [
      { id: '1', type: 'Personal', email: 'test@example.com' },
    ];

    render(<PersonEmailManager initialEmails={emails} onChange={onChange} />);

    await user.click(screen.getByText('Edit'));

    const typeInput = screen.getByDisplayValue('Personal');
    await user.clear(typeInput);
    await user.type(typeInput, 'School');

    await user.click(screen.getByText('Save'));

    expect(onChange).toHaveBeenCalledWith([
      { id: '1', type: 'School', email: 'test@example.com' },
    ]);
  });
});
