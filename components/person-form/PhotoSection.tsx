'use client';

import { useTranslations } from 'next-intl';
import PersonAvatar from '../PersonPhoto';
import PhotoCropModal from '../PhotoCropModal';
import PhotoSourceModal from '../PhotoSourceModal';

interface PhotoSectionProps {
  personId?: string;
  personPhoto?: string | null;
  personName: string;
  personSurname: string;
  photoPreview: string | null;
  photoRemoved: boolean;
  cropImageSrc: string | null;
  showPhotoSourceModal: boolean;
  onShowPhotoSourceModal: (show: boolean) => void;
  onPhotoSourceSelect: (file: File) => void;
  onCropConfirm: (blob: Blob) => void;
  onCropCancel: () => void;
  onPhotoRemove: () => void;
}

export default function PhotoSection({
  personId,
  personPhoto,
  personName,
  personSurname,
  photoPreview,
  photoRemoved,
  cropImageSrc,
  showPhotoSourceModal,
  onShowPhotoSourceModal,
  onPhotoSourceSelect,
  onCropConfirm,
  onCropCancel,
  onPhotoRemove,
}: PhotoSectionProps) {
  const tPhoto = useTranslations('people.photo');

  return (
    <>
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="relative group">
          {photoPreview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoPreview}
              alt=""
              className="w-20 h-20 rounded-full object-cover bg-surface"
            />
          ) : (
            <PersonAvatar
              personId={personId || 'new'}
              name={personName || personSurname || '?'}
              photo={photoRemoved ? null : personPhoto}
              size={80}
              loading="eager"
            />
          )}

          {/* Upload overlay on hover */}
          <button
            type="button"
            onClick={() => onShowPhotoSourceModal(true)}
            className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/40 cursor-pointer transition-colors"
          >
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
          </button>

          {/* Remove button (top-right, visible on hover) */}
          {(photoPreview || (personPhoto && !photoRemoved)) && (
            <button
              type="button"
              onClick={onPhotoRemove}
              className="absolute -top-1 -right-1 w-5 h-5 bg-warning text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title={tPhoto('removeLabel')}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
        <span className="text-xs text-muted">
          {(personPhoto && !photoRemoved) || photoPreview
            ? tPhoto('changeLabel')
            : tPhoto('uploadLabel')}
        </span>
      </div>

      {showPhotoSourceModal && (
        <PhotoSourceModal
          onSelect={onPhotoSourceSelect}
          onClose={() => onShowPhotoSourceModal(false)}
        />
      )}

      {cropImageSrc && (
        <PhotoCropModal
          imageSrc={cropImageSrc}
          onConfirm={onCropConfirm}
          onCancel={onCropCancel}
        />
      )}
    </>
  );
}
