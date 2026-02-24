/**
 * Tests for ImportSuccessToast component
 * Verifies toast notifications and URL cleanup after import
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ImportSuccessToast from '@/components/ImportSuccessToast';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'importSuccessToast') {
      return `${params?.imported} imported, ${params?.skipped} skipped`;
    }
    if (key === 'importCompleteWithErrors') {
      return `${params?.imported} imported, ${params?.errors} errors`;
    }
    return key;
  },
}));

describe('ImportSuccessToast', () => {
  const mockReplace = vi.fn();
  let mockSearchParams: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new Map();

    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      replace: mockReplace,
    });

    (useSearchParams as ReturnType<typeof vi.fn>).mockReturnValue({
      get: (key: string) => mockSearchParams.get(key) || null,
    });

    // Mock window.location for URL construction
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/people?importSuccess=true&imported=5&skipped=2&errors=0'),
    });
  });

  describe('Success toast', () => {
    it('should show success toast with import results', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '5');
      mockSearchParams.set('skipped', '2');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      expect(toast.success).toHaveBeenCalledWith('5 imported, 2 skipped');
    });

    it('should handle zero skipped contacts', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '3');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      expect(toast.success).toHaveBeenCalledWith('3 imported, 0 skipped');
    });

    it('should handle single contact import', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '1');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('Error toast', () => {
    it('should show error toast when errors occurred', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '2');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '3');

      render(<ImportSuccessToast />);

      expect(toast.error).toHaveBeenCalledWith('2 imported, 3 errors');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should prioritize error toast over success', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '5');
      mockSearchParams.set('skipped', '2');
      mockSearchParams.set('errors', '1');

      render(<ImportSuccessToast />);

      expect(toast.error).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe('URL cleanup', () => {
    it('should remove query parameters after showing toast', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '5');
      mockSearchParams.set('skipped', '2');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      expect(mockReplace).toHaveBeenCalled();

      const callArg = mockReplace.mock.calls[0][0];
      expect(callArg).not.toContain('importSuccess');
      expect(callArg).not.toContain('imported');
      expect(callArg).not.toContain('skipped');
      expect(callArg).not.toContain('errors');
    });

    it('should use replace with scroll: false', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '1');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      expect(mockReplace).toHaveBeenCalledWith(
        expect.any(String),
        { scroll: false }
      );
    });

    it('should preserve other query parameters', () => {
      // Mock URL with additional params
      Object.defineProperty(window, 'location', {
        writable: true,
        value: new URL('http://localhost/people?importSuccess=true&imported=1&skipped=0&errors=0&sortBy=name&page=2'),
      });

      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '1');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      const callArg = mockReplace.mock.calls[0][0];
      // Should keep other params
      expect(callArg).toContain('sortBy=name');
      expect(callArg).toContain('page=2');
      // Should remove import params
      expect(callArg).not.toContain('importSuccess');
    });
  });

  describe('Single execution', () => {
    it('should only show toast once on initial render', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '3');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      const { rerender } = render(<ImportSuccessToast />);

      expect(toast.success).toHaveBeenCalledTimes(1);

      // Rerender should not show toast again
      rerender(<ImportSuccessToast />);

      expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it('should not show toast when importSuccess is not present', () => {
      // No query params
      render(<ImportSuccessToast />);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should not show toast when importSuccess is false', () => {
      mockSearchParams.set('importSuccess', 'false');
      mockSearchParams.set('imported', '5');

      render(<ImportSuccessToast />);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should not show toast when imported count is missing (defaults to 0)', () => {
      mockSearchParams.set('importSuccess', 'true');
      // Missing imported, skipped, errors

      render(<ImportSuccessToast />);

      // importedCount defaults to 0, no toast should be shown (only shows if > 0)
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should not show toast for invalid count values that parse to 0', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', 'invalid');
      mockSearchParams.set('skipped', 'abc');
      mockSearchParams.set('errors', 'xyz');

      render(<ImportSuccessToast />);

      // Should parse as NaN -> 0, no toast shown
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should not show toast when zero imported with no errors', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '0');
      mockSearchParams.set('skipped', '5');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast />);

      // No toast shown if importedCount is 0 and no errors
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should render nothing (null component)', () => {
      const { container } = render(<ImportSuccessToast />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('redirectPath prop', () => {
    it('should redirect to specified path instead of cleaning URL params', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '3');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '0');

      render(<ImportSuccessToast redirectPath="/settings/carddav" />);

      expect(mockReplace).toHaveBeenCalledWith('/settings/carddav', { scroll: false });
    });
  });

  describe('errorLevel prop', () => {
    it('should use toast.warning when errorLevel is warning', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '2');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '3');

      render(<ImportSuccessToast errorLevel="warning" />);

      expect(toast.warning).toHaveBeenCalledWith('2 imported, 3 errors');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should default to toast.error when errorLevel is not specified', () => {
      mockSearchParams.set('importSuccess', 'true');
      mockSearchParams.set('imported', '2');
      mockSearchParams.set('skipped', '0');
      mockSearchParams.set('errors', '3');

      render(<ImportSuccessToast />);

      expect(toast.error).toHaveBeenCalledWith('2 imported, 3 errors');
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });
});
