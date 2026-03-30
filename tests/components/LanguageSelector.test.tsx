import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LanguageSelector from '@/components/LanguageSelector';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: vi.fn((namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      'settings.appearance.language': {
        'description': 'Choose your preferred language',
        'en': 'English',
        'esES': 'Spanish (Spain)',
      },
      'success.profile': {
        'languageChanged': 'Language updated successfully',
      },
      'common': {
        'loading': 'Loading...',
      },
    };
    return translations[namespace]?.[key] || key;
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock flag-icons CSS
vi.mock('flag-icons/css/flag-icons.min.css', () => ({}));

describe('LanguageSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    delete (window as any).location;
    (window as any).location = { reload: vi.fn() };
  });

  it('should render language selector with description', () => {
    render(<LanguageSelector currentLanguage="en" />);

    expect(screen.getByText('Choose your preferred language')).toBeInTheDocument();
  });

  it('should display English as selected by default', () => {
    render(<LanguageSelector currentLanguage="en" />);

    const englishButton = screen.getByRole('button', { name: /English/i });
    expect(englishButton).toHaveClass('border-primary');
  });

  it('should display Spanish as selected when currentLanguage is es-ES', () => {
    render(<LanguageSelector currentLanguage="es-ES" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    expect(spanishButton).toHaveClass('border-primary');
  });

  it('should change language to Spanish when clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, language: 'es-ES' }),
    });

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/language', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: 'es-ES' }),
      });
    });
  });

  it('should show loading state while updating', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true }),
      }), 100))
    );

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  it('should reload page after successful language update', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  it('should handle errors gracefully', async () => {
    const { toast } = await import('sonner');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to update' }),
    });

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update language. Please try again.');
    });

    // Should revert to previous language
    expect(spanishButton).not.toHaveClass('border-blue-600');
  });

  it('should not make API call if same language clicked', async () => {
    render(<LanguageSelector currentLanguage="en" />);

    const englishButton = screen.getByRole('button', { name: /English/i });
    fireEvent.click(englishButton);

    // Wait a bit to ensure no call is made
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should disable buttons while loading', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ success: true }),
      }), 100))
    );

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    const englishButton = screen.getByRole('button', { name: /English/i });

    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(spanishButton).toBeDisabled();
      expect(englishButton).toBeDisabled();
    });
  });

  it('should set locale cookie on successful update', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });

    render(<LanguageSelector currentLanguage="en" />);

    const spanishButton = screen.getByRole('button', { name: /Español/i });
    fireEvent.click(spanishButton);

    await waitFor(() => {
      expect(document.cookie).toContain('NEXT_LOCALE=es-ES');
    });
  });
});
