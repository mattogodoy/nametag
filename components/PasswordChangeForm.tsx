'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';

interface PasswordChangeFormProps {
  userId: string;
}

export default function PasswordChangeForm({}: PasswordChangeFormProps) {
  const t = useTranslations('settings.security');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);
    setSuccess('');

    // Validate passwords match
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwordsNoMatch'));
      return;
    }

    // Client-side password validation (matches backend requirements)
    if (formData.newPassword.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (!/[A-Z]/.test(formData.newPassword)) {
      setError(t('passwordNeedsUppercase'));
      return;
    }
    if (!/[a-z]/.test(formData.newPassword)) {
      setError(t('passwordNeedsLowercase'));
      return;
    }
    if (!/[0-9]/.test(formData.newPassword)) {
      setError(t('passwordNeedsNumber'));
      return;
    }
    if (!/[^A-Za-z0-9]/.test(formData.newPassword)) {
      setError(t('passwordNeedsSpecial'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/user/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if there are detailed validation errors
        if (data.details && Array.isArray(data.details)) {
          setValidationErrors(data.details);
          setError(data.error || t('errorValidation'));
        } else {
          setError(data.error || t('errorUpdate'));
        }
        return;
      }

      setSuccess(t('successUpdate'));
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
          <div className="font-medium">{error}</div>
          {validationErrors.length > 0 && (
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              {validationErrors.map((err, index) => (
                <li key={index}>
                  <strong>{err.field}:</strong> {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <div>
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('currentPassword')}
        </label>
        <input
          type="password"
          id="currentPassword"
          required
          value={formData.currentPassword}
          onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('newPassword')}
        </label>
        <input
          type="password"
          id="newPassword"
          required
          value={formData.newPassword}
          onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <PasswordStrengthIndicator password={formData.newPassword} showRequirements={true} />
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-muted mb-1"
        >
          {t('confirmPassword')}
        </label>
        <input
          type="password"
          id="confirmPassword"
          required
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? t('updating') : t('updatePassword')}
        </button>
      </div>
    </form>
  );
}
