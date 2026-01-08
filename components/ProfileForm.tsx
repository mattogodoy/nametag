'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface ProfileFormProps {
  userId: string;
  currentName: string;
  currentSurname: string;
  currentNickname: string;
  currentEmail: string;
}

export default function ProfileForm({ currentName, currentSurname, currentNickname, currentEmail }: ProfileFormProps) {
  const router = useRouter();
  const { update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

  const [formData, setFormData] = useState({
    name: currentName,
    surname: currentSurname,
    nickname: currentNickname,
    email: currentEmail,
  });

  const emailChanged = formData.email !== currentEmail;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Show confirmation dialog if email is being changed
    if (emailChanged) {
      setShowEmailConfirm(true);
      return;
    }

    await saveProfile();
  };

  const saveProfile = async () => {
    setIsLoading(true);
    setShowEmailConfirm(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      if (data.emailChanged) {
        // Email was changed - sign out the user
        await signOut({ callbackUrl: '/login' });
        return;
      }

      setSuccess('Profile updated successfully');

      // Update the session with new data
      await update({
        name: formData.name,
        surname: formData.surname,
        nickname: formData.nickname,
        email: formData.email,
      });

      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-muted mb-1"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium text-muted mb-1"
            >
              Surname
            </label>
            <input
              type="text"
              id="surname"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-muted mb-1"
            >
              Nickname
            </label>
            <input
              type="text"
              id="nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Email Change Confirmation Dialog */}
      {showEmailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Confirm Email Change
            </h3>
            <p className="text-muted mb-4">
              You are about to change your email address to <strong className="text-foreground">{formData.email}</strong>.
            </p>
            <p className="text-muted mb-6">
              A verification email will be sent to your new address. You will be logged out and won&apos;t be able to log in until you verify your new email.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowEmailConfirm(false)}
                className="px-4 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark shadow-lg hover:shadow-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Confirm & Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
