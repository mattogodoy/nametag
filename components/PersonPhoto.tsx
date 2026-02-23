'use client';

import { useState, useCallback } from 'react';

interface PersonPhotoProps {
  src: string;
  name: string;
}

export default function PersonPhoto({ src, name }: PersonPhotoProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  // Use a ref callback to catch images that loaded before hydration
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalHeight > 0) {
      setLoaded(true);
    }
  }, []);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  if (errored) {
    return null;
  }

  return (
    <div className="relative w-32 h-32">
      {/* Initials placeholder — visible until image loads */}
      {!loaded && (
        <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-2xl font-semibold text-gray-500 dark:text-gray-400">
            {initials}
          </span>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={name}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`w-32 h-32 rounded-full object-cover shadow-lg transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
