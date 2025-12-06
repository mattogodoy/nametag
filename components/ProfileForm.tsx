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

export default function ProfileForm({ userId, currentName, currentSurname, currentNickname, currentEmail }: ProfileFormProps) {
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
        await signOut({ callbackUrl: '/login' });
        return;
      }

      setSuccess('Profile updated successfully');

      await update({
        name: formData.name,
        surname: formData.surname,
        nickname: formData.nickname,
        email: formData.email,
      });

      router.refresh();

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="alert alert-error">
            <span className="icon-[tabler--alert-circle] size-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span className="icon-[tabler--check] size-5" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-control">
            <label htmlFor="name" className="label">
              <span className="label-text">Name</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div className="form-control">
            <label htmlFor="surname" className="label">
              <span className="label-text">Surname</span>
            </label>
            <input
              type="text"
              id="surname"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="input"
            />
          </div>

          <div className="form-control">
            <label htmlFor="nickname" className="label">
              <span className="label-text">Nickname</span>
            </label>
            <input
              type="text"
              id="nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div className="form-control">
          <label htmlFor="email" className="label">
            <span className="label-text">Email</span>
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading && <span className="loading loading-spinner loading-sm" />}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Email Change Confirmation Dialog */}
      {showEmailConfirm && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Confirm Email Change</h3>
            <p className="py-4 text-base-content/70">
              You are about to change your email address to <strong>{formData.email}</strong>.
            </p>
            <p className="text-base-content/70">
              A verification email will be sent to your new address. You will be logged out and won&apos;t be able to log in until you verify your new email.
            </p>
            <div className="modal-action">
              <button
                type="button"
                onClick={() => setShowEmailConfirm(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading && <span className="loading loading-spinner loading-sm" />}
                {isLoading ? 'Saving...' : 'Confirm & Log Out'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setShowEmailConfirm(false)}>close</button>
          </form>
        </dialog>
      )}
    </>
  );
}
