'use client';

import { getUserPhotoUrl } from '@/lib/photo-url';

const SIZES = {
  sm: { box: 'w-8 h-8', initials: 'text-sm' },
  md: { box: 'w-10 h-10', initials: 'text-base' },
} as const;

interface UserAvatarProps {
  displayName: string;
  photo?: string | null;
  size?: keyof typeof SIZES;
}

/**
 * The signed-in user's photo, or their initial when no photo is set.
 * Decorative in every current call site: the display name is always rendered
 * next to it, so the image carries an empty alt rather than repeating it.
 */
export default function UserAvatar({ displayName, photo, size = 'sm' }: UserAvatarProps) {
  const photoUrl = getUserPhotoUrl(photo);
  const { box, initials } = SIZES[size];

  if (photoUrl) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={photoUrl}
        alt=""
        className={`${box} rounded-full object-cover bg-surface border border-border flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${box} rounded-full bg-surface-elevated border border-border flex items-center justify-center flex-shrink-0`}>
      <span className={`${initials} font-medium text-secondary`}>{displayName.charAt(0).toUpperCase()}</span>
    </div>
  );
}
