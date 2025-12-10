import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

describe('PasswordStrengthIndicator', () => {
  describe('Strength Calculation', () => {
    it('should show nothing for empty password', () => {
      const { container } = render(<PasswordStrengthIndicator password="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should show "Very Weak" for password with only 1 requirement', () => {
      const { container } = render(<PasswordStrengthIndicator password="password" />);
      expect(container).toHaveTextContent('Very Weak');
    });

    it('should show "Weak" for password with 2 requirements', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password" />);
      expect(container).toHaveTextContent('Weak');
    });

    it('should show "Medium" for password with 3 requirements', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password1" />);
      expect(container).toHaveTextContent('Medium');
    });

    it('should show "Strong" for password with 4 requirements', () => {
      const { container } = render(<PasswordStrengthIndicator password="Pass1!ab" />);
      expect(container).toHaveTextContent('Strong');
    });

    it('should show "Very Strong" for password meeting all 5 requirements', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password1!" />);
      expect(container).toHaveTextContent('Very Strong');
    });
  });

  describe('Requirements Display', () => {
    it('should show all requirements by default', () => {
      render(<PasswordStrengthIndicator password="test" />);
      
      expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/One uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/One lowercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/One number/i)).toBeInTheDocument();
      expect(screen.getByText(/One special character/i)).toBeInTheDocument();
    });

    it('should hide requirements when showRequirements is false', () => {
      render(<PasswordStrengthIndicator password="test" showRequirements={false} />);
      
      expect(screen.queryByText(/At least 8 characters/i)).not.toBeInTheDocument();
    });

    it('should mark met requirements with green checkmark', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password123!" />);
      
      // All requirements should be met (green checkmarks)
      const greenIcons = container.querySelectorAll('.text-green-500');
      expect(greenIcons.length).toBe(5);
    });

    it('should mark unmet requirements with gray X', () => {
      const { container } = render(<PasswordStrengthIndicator password="pass" />);
      
      // Most requirements not met (gray X icons)
      const grayIcons = container.querySelectorAll('.text-gray-400');
      expect(grayIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Visual Feedback', () => {
    it('should show red bar for very weak password', () => {
      const { container } = render(<PasswordStrengthIndicator password="pass" />);
      const bar = container.querySelector('.bg-red-500');
      expect(bar).toBeInTheDocument();
    });

    it('should show orange bar for weak password', () => {
      const { container } = render(<PasswordStrengthIndicator password="Pass1" />);
      const bar = container.querySelector('.bg-orange-500');
      expect(bar).toBeInTheDocument();
    });

    it('should show yellow bar for medium password', () => {
      const { container } = render(<PasswordStrengthIndicator password="Pass1!a" />);
      const bar = container.querySelector('.bg-yellow-500');
      expect(bar).toBeInTheDocument();
    });

    it('should show blue bar for strong password', () => {
      const { container } = render(<PasswordStrengthIndicator password="Pass1!ab" />);
      const bar = container.querySelector('.bg-blue-500');
      expect(bar).toBeInTheDocument();
    });

    it('should show green bar for very strong password', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password1!" />);
      const bar = container.querySelector('.bg-green-500');
      expect(bar).toBeInTheDocument();
    });
  });

  describe('Specific Requirements', () => {
    it('should detect minimum length requirement', () => {
      const { container } = render(<PasswordStrengthIndicator password="Pass1!" />);
      
      // 6 characters, doesn't meet 8 minimum
      const lengthReq = screen.getByText(/At least 8 characters/i);
      expect(lengthReq.parentElement?.querySelector('.text-gray-400')).toBeInTheDocument();
      
      // 8 characters, meets minimum
      const { container: container2 } = render(<PasswordStrengthIndicator password="Pass123!" />);
      const lengthReq2 = screen.getAllByText(/At least 8 characters/i)[1];
      expect(lengthReq2.parentElement?.querySelector('.text-green-500')).toBeInTheDocument();
    });

    it('should detect uppercase requirement', () => {
      render(<PasswordStrengthIndicator password="password123!" />);
      const req = screen.getByText(/One uppercase letter/i);
      expect(req.parentElement?.querySelector('.text-gray-400')).toBeInTheDocument();
    });

    it('should detect lowercase requirement', () => {
      render(<PasswordStrengthIndicator password="PASSWORD123!" />);
      const req = screen.getByText(/One lowercase letter/i);
      expect(req.parentElement?.querySelector('.text-gray-400')).toBeInTheDocument();
    });

    it('should detect number requirement', () => {
      render(<PasswordStrengthIndicator password="Password!" />);
      const req = screen.getByText(/One number/i);
      expect(req.parentElement?.querySelector('.text-gray-400')).toBeInTheDocument();
    });

    it('should detect special character requirement', () => {
      render(<PasswordStrengthIndicator password="Password123" />);
      const req = screen.getByText(/One special character/i);
      expect(req.parentElement?.querySelector('.text-gray-400')).toBeInTheDocument();
    });
  });

  describe('Real-world Passwords', () => {
    const testCases = [
      { password: 'pass', expectedLabel: 'Very Weak', expectedScore: 1 },
      { password: 'Password', expectedLabel: 'Weak', expectedScore: 2 },
      { password: 'Password1', expectedLabel: 'Medium', expectedScore: 3 },
      { password: 'Pass123!', expectedLabel: 'Strong', expectedScore: 4 },
      { password: 'Password123!', expectedLabel: 'Very Strong', expectedScore: 5 },
      { password: 'MySecureP@ss1', expectedLabel: 'Very Strong', expectedScore: 5 },
      { password: 'Test@123', expectedLabel: 'Very Strong', expectedScore: 5 },
    ];

    testCases.forEach(({ password, expectedLabel, expectedScore }) => {
      it(`should evaluate "${password}" as ${expectedLabel} (score: ${expectedScore})`, () => {
        const { container } = render(<PasswordStrengthIndicator password={password} />);
        
        if (expectedLabel) {
          expect(container).toHaveTextContent(expectedLabel);
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('should have meaningful color-coded feedback', () => {
      const { container } = render(<PasswordStrengthIndicator password="Password123!" />);
      
      // Should have green color for very strong
      expect(container.querySelector('.text-green-600')).toBeInTheDocument();
      expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    });

    it('should show checkmarks for met requirements', () => {
      render(<PasswordStrengthIndicator password="Password123!" />);
      
      // All 5 requirements should show green checkmarks
      const checkmarks = screen.getAllByRole('img', { hidden: true });
      expect(checkmarks.length).toBeGreaterThanOrEqual(5);
    });
  });
});

