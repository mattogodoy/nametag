'use client';

import { useMemo } from 'react';

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

interface StrengthResult {
  score: number; // 0-5
  label: string;
  color: string;
  barColor: string;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
}

export function PasswordStrengthIndicator({
  password,
  showRequirements = true,
}: PasswordStrengthIndicatorProps) {
  const strength = useMemo((): StrengthResult => {
    if (!password) {
      return {
        score: 0,
        label: '',
        color: '',
        barColor: '',
        requirements: {
          minLength: false,
          hasUppercase: false,
          hasLowercase: false,
          hasNumber: false,
          hasSpecialChar: false,
        },
      };
    }

    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[^A-Za-z0-9]/.test(password),
    };

    // Calculate score based on requirements met
    const metCount = Object.values(requirements).filter(Boolean).length;
    
    let score = 0;
    let label = '';
    let color = '';
    let barColor = '';

    if (password.length === 0) {
      score = 0;
      label = '';
      color = '';
      barColor = '';
    } else if (metCount === 5) {
      score = 5;
      label = 'Very Strong';
      color = 'text-green-600 dark:text-green-400';
      barColor = 'bg-green-500';
    } else if (metCount === 4) {
      score = 4;
      label = 'Strong';
      color = 'text-blue-600 dark:text-blue-400';
      barColor = 'bg-blue-500';
    } else if (metCount === 3) {
      score = 3;
      label = 'Medium';
      color = 'text-yellow-600 dark:text-yellow-400';
      barColor = 'bg-yellow-500';
    } else if (metCount === 2) {
      score = 2;
      label = 'Weak';
      color = 'text-orange-600 dark:text-orange-400';
      barColor = 'bg-orange-500';
    } else {
      score = 1;
      label = 'Very Weak';
      color = 'text-red-600 dark:text-red-400';
      barColor = 'bg-red-500';
    }

    return { score, label, color, barColor, requirements };
  }, [password]);

  if (!password) {
    return null;
  }

  const widthPercentage = (strength.score / 5) * 100;

  return (
    <div className="space-y-2">
      {/* Strength Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-in-out ${strength.barColor}`}
            style={{ width: `${widthPercentage}%` }}
          />
        </div>
        {strength.label && (
          <span className={`text-sm font-medium ${strength.color} min-w-[90px] text-right`}>
            {strength.label}
          </span>
        )}
      </div>

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="space-y-1 text-xs">
          <RequirementItem
            met={strength.requirements.minLength}
            text="At least 8 characters"
          />
          <RequirementItem
            met={strength.requirements.hasUppercase}
            text="One uppercase letter (A-Z)"
          />
          <RequirementItem
            met={strength.requirements.hasLowercase}
            text="One lowercase letter (a-z)"
          />
          <RequirementItem
            met={strength.requirements.hasNumber}
            text="One number (0-9)"
          />
          <RequirementItem
            met={strength.requirements.hasSpecialChar}
            text="One special character (!@#$%^&*)"
          />
        </div>
      )}
    </div>
  );
}

interface RequirementItemProps {
  met: boolean;
  text: string;
}

function RequirementItem({ met, text }: RequirementItemProps) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <svg
          className="w-4 h-4 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-gray-400 dark:text-gray-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className={met ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}>
        {text}
      </span>
    </div>
  );
}

