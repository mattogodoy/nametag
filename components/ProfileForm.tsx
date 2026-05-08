'use client';

import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from './ui/Button';
import PersonAvatar from './PersonPhoto';
import PhotoCropModal from './PhotoCropModal';
import { getUserPhotoUrl } from '@/lib/photo-url';

interface ProfileFormProps {
  userId: string;
  currentName: string;
  currentSurname: string;
  currentNickname: string;
  currentEmail: string;
  currentPhoto: string | null;
}

export default function ProfileForm({ userId, currentName, currentSurname, currentNickname, currentEmail, currentPhoto }: ProfileFormProps) {
  const t = useTranslations('settings.profile');
  const tPhoto = useTranslations('people.photo');
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

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50MB

  const emailChanged = formData.email !== currentEmail;

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      toast.error(tPhoto('formatError'));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      toast.error(tPhoto('sizeError'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (blob: Blob) => {
    setCropImageSrc(null);

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    const previewUrl = URL.createObjectURL(blob);
    setPhotoPreview(previewUrl);
    setPhotoRemoved(false);
    setPendingPhotoBlob(blob);
  };

  const handlePhotoRemove = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoRemoved(true);
    setPendingPhotoBlob(null);
  };

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
        setError(data.error || t('errorUpdate'));
        return;
      }

      if (data.emailChanged) {
        // Email was changed - sign out the user
        await signOut({ callbackUrl: '/login' });
        return;
      }

      // Handle deferred photo upload/delete
      let newPhoto: string | null | undefined;
      if (pendingPhotoBlob) {
        const photoFormData = new FormData();
        photoFormData.append('photo', pendingPhotoBlob, 'photo.png');
        const photoRes = await fetch('/api/user/photo', {
          method: 'POST',
          body: photoFormData,
        });
        if (!photoRes.ok) {
          toast.error(tPhoto('uploadError'));
        } else {
          const photoData = await photoRes.json();
          newPhoto = photoData.photo;
          setPendingPhotoBlob(null);
        }
      } else if (photoRemoved) {
        const photoRes = await fetch('/api/user/photo', {
          method: 'DELETE',
        });
        if (!photoRes.ok) {
          toast.error(tPhoto('removeError'));
        } else {
          newPhoto = null;
          setPhotoRemoved(false);
        }
      }

      setSuccess(t('successUpdate'));

      // Update the session with new data (including photo if changed)
      await update({
        name: formData.name,
        surname: formData.surname,
        nickname: formData.nickname,
        email: formData.email,
        ...(newPhoto !== undefined ? { photo: newPhoto } : {}),
      });

      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError(t('errorConnection'));
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve user photo URL directly (can't use PersonAvatar for this
  // because it routes through getPhotoUrl which builds /api/photos/{personId})
  const hasExistingPhoto = currentPhoto && !photoRemoved;
  const userPhotoUrl = hasExistingPhoto ? getUserPhotoUrl(currentPhoto) : null;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {/* Photo Section */}
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="relative group">
            {photoPreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={photoPreview} alt="" className="w-20 h-20 rounded-full object-cover bg-white dark:bg-black" />
            ) : userPhotoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={userPhotoUrl} alt="" className="w-20 h-20 rounded-full object-cover bg-white dark:bg-black" />
            ) : (
              <PersonAvatar
                personId={userId}
                name={formData.name || formData.surname || '?'}
                photo={null}
                size={80}
                loading="eager"
              />
            )}

            {/* Upload overlay on hover */}
            <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 cursor-pointer transition-colors">
              <svg
                className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>

            {/* Remove button (top-right, visible on hover) */}
            {(photoPreview || (currentPhoto && !photoRemoved)) && (
              <button
                type="button"
                onClick={handlePhotoRemove}
                className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title={tPhoto('removeLabel')}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <span className="text-xs text-muted">
            {(currentPhoto && !photoRemoved) || photoPreview ? tPhoto('changeLabel') : tPhoto('uploadLabel')}
          </span>
        </div>

        {/* Crop modal */}
        {cropImageSrc && (
          <PhotoCropModal
            imageSrc={cropImageSrc}
            onConfirm={handleCropConfirm}
            onCancel={() => setCropImageSrc(null)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('name')}
            </label>
            <input
              type="text"
              id="name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="surname"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('surname')}
            </label>
            <input
              type="text"
              id="surname"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-muted mb-1"
            >
              {t('nickname')}
            </label>
            <input
              type="text"
              id="nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted mb-1"
          >
            {t('email')}
          </label>
          <input
            type="email"
            id="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </form>

      {/* Email Change Confirmation Dialog */}
      {showEmailConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-surface rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">
              {t('emailChange.title')}
            </h3>
            <p className="text-muted mb-4">
              {t('emailChange.message')} <strong className="text-foreground">{formData.email}</strong>.
            </p>
            <p className="text-muted mb-6">
              {t('emailChange.warning')}
            </p>
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="secondary" onClick={() => setShowEmailConfirm(false)}>
                {t('emailChange.cancel')}
              </Button>
              <Button type="button" onClick={saveProfile} disabled={isLoading}>
                {isLoading ? t('saving') : t('emailChange.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
