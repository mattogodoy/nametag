'use client';

import { useState, useCallback, memo } from 'react';
import { getPhotoUrl } from '@/lib/photo-url';

interface PersonAvatarProps {
  personId: string;
  name: string;
  photo?: string | null;
  size?: number;
  loading?: 'lazy' | 'eager';
  className?: string;
}

export default memo(function PersonAvatar({
  personId,
  name,
  photo,
  size = 32,
  loading = 'lazy',
  className = '',
}: PersonAvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const src = getPhotoUrl(personId, photo);

  // Use a ref callback to catch images that loaded before hydration
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalHeight > 0) {
      setLoaded(true);
    }
  }, []);

  const initials = name
    .replace(/[''\u2018\u2019][^''\u2018\u2019]*[''\u2018\u2019]/g, '')
    .replace(/[""\u201C\u201D][^""\u201C\u201D]*[""\u201C\u201D]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const fontSize = Math.max(10, Math.round(size * 0.35));

  const showImage = src && !errored;

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Initials fallback — shown when no photo, on error, or while loading */}
      {(!showImage || !loaded) && (
        <div
          className={`absolute inset-0 rounded-full bg-surface-elevated flex items-center justify-center ${showImage ? 'animate-pulse' : ''}`}
        >
          <span
            className="font-semibold text-muted select-none"
            style={{ fontSize }}
          >
            {initials}
          </span>
        </div>
      )}
      {/* Photo image */}
      {showImage && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          ref={imgRef}
          src={src}
          alt={name}
          loading={loading}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`rounded-full object-cover bg-surface transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
});
