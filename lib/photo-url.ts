/**
 * Check if a photo value is a stored filename (not a URL or data URI)
 * Duplicated from photo-storage.ts to avoid importing Node.js fs modules in client code
 */
function isStoredFilename(photo: string): boolean {
  return !photo.startsWith('data:') && !photo.startsWith('http://') && !photo.startsWith('https://');
}

/**
 * Get the URL for displaying a person's photo
 * Returns /api/photos/{personId} for file-based photos,
 * or the raw value for legacy data URIs/URLs
 */
export function getPhotoUrl(personId: string, photo: string | null | undefined): string | null {
  if (!photo) return null;

  if (isStoredFilename(photo)) {
    return `/api/photos/${personId}`;
  }

  // Legacy: data URI or external URL — return as-is
  return photo;
}
